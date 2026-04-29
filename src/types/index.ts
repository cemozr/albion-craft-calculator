// ─── Item & Recipe types ─────────────────────────────────────────────────────

export interface ItemEntry {
  UniqueName: string;
  LocalizedNames?: Record<string, string>;
  LocalizedDescriptions?: Record<string, string>;
}

/** Parsed item: id → English display name */
export type ItemsMap = Record<string, string>;

/** A single ingredient in a recipe */
export interface Ingredient {
  itemId: string; // e.g. "T4_METALBAR" or "T4_METALBAR_LEVEL1@1"
  displayName: string;
  quantity: number;
  maxStackSize?: number;
}

/** A craftable item's recipe */
export interface Recipe {
  itemId: string; // output item e.g. "T4_2H_CLAYMORE@1"
  outputQuantity: number;
  silver?: number; // crafting silver cost in raw silver
  ingredients: Ingredient[];
  /** Crafting station type (for fee estimation) */
  craftingFocus?: number;
}

// ─── Price data ──────────────────────────────────────────────────────────────

/** Raw price object returned by albion-online-data.com */
export interface RawPriceData {
  item_id: string;
  city: string;
  quality: number;
  sell_price_min: number;
  sell_price_min_date: string;
  sell_price_max: number;
  sell_price_max_date: string;
  buy_price_min: number;
  buy_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
}

/** Best market price for an item at a location */
export interface PriceEntry {
  itemId: string;
  city: string;
  sellMin: number;
  buyMax: number;
  updatedAt: string; // sell_price_min_date
  buyMaxDate: string; // buy_price_max_date
}

/** itemId → city → PriceEntry */
export type PriceMap = Record<string, Record<string, PriceEntry>>;

// ─── Crafting params ─────────────────────────────────────────────────────────

export interface CraftingParams {
  hasPremium: boolean;
  useFocus: boolean;
  useBuyOrderMaterials: boolean; // buy ingredients via buy order (uses buyMax price + 2.5% setup fee)
  manualReturnRate: number | null; // null = auto from focus/premium, 0–1 = manual override
  marketTax: number; // 0–1, e.g. 0.03 for 3%
  craftingFee: number; // flat silver per craft (includes station tax)
  craftingCity: string; // where you craft
  sellCity: string; // where you sell
  buyCity: string; // where you buy ingredients
  quality: number; // 1=Normal, 2=Good, 3=Outstanding, 4=Excellent, 5=Masterpiece
  sellMode: "sell-order" | "sell-now"; // sell-order: list item (sellMin + 2.5% fee); sell-now: fill buy order (buyMax, no fee)
}

// ─── Calculator output ───────────────────────────────────────────────────────

export interface IngredientCost {
  ingredient: Ingredient;
  unitPrice: number;
  totalCost: number;
  priceCity: string;
  updatedAt: string;
  missingPrice: boolean;
}

export interface CraftResult {
  itemId: string;
  displayName: string;
  recipe: Recipe;
  ingredientCosts: IngredientCost[];
  totalIngredientCost: number;
  effectiveReturnRate: number; // the rate actually used
  effectiveCost: number; // after return rate
  craftingFee: number;
  buyOrderSetupFee: number; // 2.5% of raw ingredient cost when useBuyOrderMaterials
  sellOrderSetupFee: number; // 2.5% of sell price × outputQty, paid upfront when listing
  totalCost: number; // effectiveCost + craftingFee + buyOrderSetupFee + sellOrderSetupFee
  sellPrice: number;
  revenue: number; // sell price after market tax
  profit: number; // revenue - totalCost
  roi: number; // profit / totalCost * 100
  missingPrices: boolean;
}

// ─── Compare list ────────────────────────────────────────────────────────────

export interface CompareEntry {
  id: string;
  tier: number;
  enchant: number;
  params: CraftingParams;
  result: CraftResult;
  addedAt: number; // Date.now()
}

// ─── UI state types ──────────────────────────────────────────────────────────

export type Tier = 4 | 5 | 6 | 7 | 8;
export type EnchantLevel = 0 | 1 | 2 | 3 | 4;

export const TIERS: Tier[] = [4, 5, 6, 7, 8];
export const ENCHANT_LEVELS: EnchantLevel[] = [0, 1, 2, 3, 4];

export const CITIES = [
  "Caerleon",
  "Bridgewatch",
  "Fort Sterling",
  "Lymhurst",
  "Martlock",
  "Thetford",
  "Brecilien",
  "Black Market",
] as const;

export type City = (typeof CITIES)[number];

// Declare global window.api type
declare global {
  interface Window {
    api: {
      fetchPrices: (
        itemIds: string[],
        locations: string[],
        quality: number,
      ) => Promise<RawPriceData[]>;
      fetchItems: () => Promise<ItemEntry[]>;
      fetchRecipes: () => Promise<Record<string, unknown>>;
      clearCache: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
