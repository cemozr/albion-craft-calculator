import type { ItemEntry, ItemsMap, Recipe, Ingredient } from "../types";

// ─── Items cache ─────────────────────────────────────────────────────────────

let itemsMap: ItemsMap | null = null;
let recipesRaw: Record<string, unknown> | null = null;

export async function loadItems(): Promise<ItemsMap> {
  if (itemsMap) return itemsMap;
  const entries: ItemEntry[] = await window.api.fetchItems();
  itemsMap = {};
  for (const entry of entries) {
    const name = entry.LocalizedNames?.["EN-US"] ?? entry.UniqueName;
    itemsMap[entry.UniqueName] = name;
  }
  return itemsMap;
}

export async function loadRecipes(): Promise<Record<string, unknown>> {
  if (recipesRaw) return recipesRaw;
  recipesRaw = await window.api.fetchRecipes();
  return recipesRaw!;
}

export function getItemName(id: string, items: ItemsMap): string {
  return items[id] ?? id;
}

// ─── Enchanted resource helper ───────────────────────────────────────────────

/**
 * Given a base resource ID and an enchant level, return the correct ID.
 * T4_METALBAR + enchant 1 → T4_METALBAR_LEVEL1@1
 * T4_METALBAR + enchant 0 → T4_METALBAR (unchanged)
 */
export function enchantResourceId(
  baseId: string,
  enchantLevel: number,
): string {
  if (enchantLevel === 0) return baseId;
  return `${baseId}_LEVEL${enchantLevel}@${enchantLevel}`;
}

// ─── Recipe parsing ──────────────────────────────────────────────────────────

interface RawCraftReq {
  "@silver"?: string;
  "@craftingfocus"?: string;
  "@amountcrafted"?: string;
  craftresource?: RawCraftResource | RawCraftResource[];
}

interface RawCraftResource {
  "@uniquename": string;
  "@count": string;
  "@maxreturnamount"?: string;
}

function parseIngredients(
  craftReq: RawCraftReq,
  enchantLevel: number,
  items: ItemsMap,
): Ingredient[] {
  if (!craftReq.craftresource) return [];
  const resources = Array.isArray(craftReq.craftresource)
    ? craftReq.craftresource
    : [craftReq.craftresource];

  return resources.map((r) => {
    const baseId = r["@uniquename"];
    // Enchant the resource ID if it's a raw material (not an artifact / journal / etc.)
    // Artifacts and special items typically contain 'ARTEFACT', 'JOURNAL', 'RUNE', etc.
    const isSpecial = /ARTEFACT|JOURNAL|RUNE|SOUL|RELIC|SHARD/i.test(baseId);
    const itemId = isSpecial ? baseId : enchantResourceId(baseId, enchantLevel);

    return {
      itemId,
      displayName: getItemName(itemId, items),
      quantity: parseInt(r["@count"] ?? "1", 10),
    };
  });
}

/**
 * Resolve recipe for a specific tier + enchant combination.
 * `baseItemKey` is the item key without tier prefix, e.g. "2H_CLAYMORE"
 * The function looks up T{tier}_{baseItemKey} in the recipes map.
 */
export function resolveRecipe(
  tier: number,
  enchantLevel: number,
  baseItemKey: string,
  rawRecipes: Record<string, unknown>,
  items: ItemsMap,
): Recipe | null {
  const baseId = `T${tier}_${baseItemKey}`;
  const outputId = enchantLevel > 0 ? `${baseId}@${enchantLevel}` : baseId;

  // Recipes are keyed by the BASE item id (without @enchant), but we craft the enchanted version
  const craftReqs = rawRecipes[baseId] as RawCraftReq[] | undefined;
  if (!craftReqs || craftReqs.length === 0) return null;

  // Take the first recipe variant (some items have multiple crafting paths)
  const req = craftReqs[0];

  const outputQty = parseInt(req["@amountcrafted"] ?? "1", 10);
  const ingredients = parseIngredients(req, enchantLevel, items);

  return {
    itemId: outputId,
    outputQuantity: outputQty,
    silver: req["@silver"] ? parseInt(req["@silver"], 10) : undefined,
    craftingFocus: req["@craftingfocus"]
      ? parseInt(req["@craftingfocus"], 10)
      : undefined,
    ingredients,
  };
}

/**
 * Returns a flat list of all craftable item keys (without tier prefix)
 * from the raw recipes map: "T4_2H_CLAYMORE" → "2H_CLAYMORE"
 */
export function extractCraftableKeys(
  rawRecipes: Record<string, unknown>,
): string[] {
  const keys = new Set<string>();
  for (const id of Object.keys(rawRecipes)) {
    // Strip tier prefix T{n}_
    const match = id.match(/^T\d+_(.+)$/);
    if (match) keys.add(match[1]);
  }
  return Array.from(keys).sort();
}

/**
 * Returns craftable item IDs available at the given tier.
 */
export function getCraftableItemsForTier(
  tier: number,
  rawRecipes: Record<string, unknown>,
): string[] {
  const prefix = `T${tier}_`;
  return Object.keys(rawRecipes)
    .filter((id) => id.startsWith(prefix))
    .sort();
}

/** Clear in-memory caches (e.g. after user clears disk cache) */
export function clearRecipeCache(): void {
  itemsMap = null;
  recipesRaw = null;
}
