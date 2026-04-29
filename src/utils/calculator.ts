import type {
  Recipe,
  PriceMap,
  CraftingParams,
  CraftResult,
  IngredientCost,
  ItemsMap,
} from "../types";

/**
 * Base return rates for each focus/premium combination.
 * Source: Albion Online community-verified values.
 *
 *   no focus, no premium: 15.2 %
 *   no focus, premium:    24.8 %
 *   focus,    no premium: 36.7 %
 *   focus,    premium:    47.9 %
 */
export function getBaseReturnRate(
  useFocus: boolean,
  hasPremium: boolean,
): number {
  if (useFocus && hasPremium) return 0.479;
  if (useFocus && !hasPremium) return 0.367;
  if (!useFocus && hasPremium) return 0.248;
  return 0.152;
}

/** Effective return rate: manual override if set, otherwise focus/premium combination */
export function getEffectiveReturnRate(params: CraftingParams): number {
  if (params.manualReturnRate !== null) return params.manualReturnRate;
  return getBaseReturnRate(params.useFocus, params.hasPremium);
}
import { getBestSellPrice, getBestBuyPrice } from "../services/priceService";
import { getItemName } from "../services/recipeService";

/**
 * Full profit calculation for a single craft.
 *
 * Formula:
 *   effectiveReturnRate = getBaseReturnRate(useFocus, hasPremium)
 *   effectiveCost       = Σ(qty × price) × (1 - effectiveReturnRate)
 *   revenue             = sellPrice × (1 - marketTax)
 *   profit              = revenue - effectiveCost - craftingFee
 *   roi                 = profit / (effectiveCost + craftingFee) × 100
 */
export function calculateProfit(
  recipe: Recipe,
  priceMap: PriceMap,
  params: CraftingParams,
  items: ItemsMap,
): CraftResult {
  const {
    marketTax,
    craftingFee,
    buyCity,
    sellCity,
    useBuyOrderMaterials,
    sellMode,
  } = params;

  const effectiveReturnRate = getEffectiveReturnRate(params);

  // ── Ingredient costs ───────────────────────────────────────────────────────
  const ingredientCosts: IngredientCost[] = recipe.ingredients.map((ing) => {
    if (useBuyOrderMaterials) {
      const entry = getBestBuyPrice(priceMap, ing.itemId, [buyCity]);
      const unitPrice = entry?.buyMax ?? 0;
      const totalCost = ing.quantity * unitPrice;
      return {
        ingredient: ing,
        unitPrice,
        totalCost,
        priceCity: entry?.city ?? buyCity,
        updatedAt: entry?.buyMaxDate ?? "",
        missingPrice: !entry || entry.buyMax <= 0,
      };
    } else {
      const entry = getBestSellPrice(priceMap, ing.itemId, [buyCity]);
      const unitPrice = entry?.sellMin ?? 0;
      const totalCost = ing.quantity * unitPrice;
      return {
        ingredient: ing,
        unitPrice,
        totalCost,
        priceCity: entry?.city ?? buyCity,
        updatedAt: entry?.updatedAt ?? "",
        missingPrice: !entry || entry.sellMin <= 0,
      };
    }
  });

  const rawIngredientCost = ingredientCosts.reduce(
    (sum, ic) => sum + ic.totalCost,
    0,
  );
  const effectiveCost = rawIngredientCost * (1 - effectiveReturnRate);

  // Buy order setup fee: 2.5% of raw material cost (charged when placing the order)
  const buyOrderSetupFee = useBuyOrderMaterials ? rawIngredientCost * 0.025 : 0;

  // Silver ingredient cost from recipe (flat fee)
  const silverCost = recipe.silver ?? 0;

  // ── Revenue ────────────────────────────────────────────────────────────────
  // sell-order: list item at sellMin, pay 2.5% listing fee upfront
  // sell-now:   instantly fill the best buy order (buyMax), no listing fee
  const safeTax = isNaN(marketTax) ? 0 : marketTax;
  let sellPrice: number;
  let sellOrderSetupFee: number;
  let sellMissingPrice: boolean;

  if (sellMode === "sell-now") {
    const sellEntry = getBestBuyPrice(priceMap, recipe.itemId, [sellCity]);
    sellPrice = sellEntry?.buyMax ?? 0;
    sellOrderSetupFee = 0;
    sellMissingPrice = !sellEntry || sellEntry.buyMax <= 0;
  } else {
    // sell-order (default)
    const sellEntry = getBestSellPrice(priceMap, recipe.itemId, [sellCity]);
    sellPrice = sellEntry?.sellMin ?? 0;
    sellOrderSetupFee = sellPrice * recipe.outputQuantity * 0.025;
    sellMissingPrice = !sellEntry || sellEntry.sellMin <= 0;
  }

  const revenue = sellPrice * (1 - safeTax) * recipe.outputQuantity;

  const totalCost =
    effectiveCost +
    craftingFee +
    silverCost +
    buyOrderSetupFee +
    sellOrderSetupFee;

  // ── Profit ─────────────────────────────────────────────────────────────────
  const profit = revenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const missingPrices =
    ingredientCosts.some((ic) => ic.missingPrice) || sellMissingPrice;

  const displayName = getItemName(recipe.itemId, items);

  return {
    itemId: recipe.itemId,
    displayName,
    recipe,
    ingredientCosts,
    totalIngredientCost: rawIngredientCost,
    effectiveReturnRate,
    effectiveCost,
    craftingFee,
    buyOrderSetupFee,
    sellOrderSetupFee,
    totalCost,
    sellPrice,
    revenue,
    profit,
    roi,
    missingPrices,
  };
}

/** Format silver number with thousands separator */
export function formatSilver(amount: number): string {
  if (amount === 0) return "0";
  return Math.round(amount).toLocaleString("en-US");
}

/** Format ROI percentage */
export function formatRoi(roi: number): string {
  return `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
}

/** Color class for profit/loss */
export function profitColor(profit: number): string {
  if (profit > 0) return "positive";
  if (profit < 0) return "negative";
  return "neutral";
}
