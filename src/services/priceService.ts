import type { RawPriceData, PriceEntry, PriceMap } from "../types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: PriceMap;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
// Deduplicates concurrent requests for the same key so parallel callers
// share one in-flight fetch instead of triggering redundant API calls.
const inflight = new Map<string, Promise<PriceMap>>();

function cacheKey(
  itemIds: string[],
  locations: string[],
  quality: number,
): string {
  return `${[...itemIds].sort().join(",")}|${[...locations].sort().join(",")}|${quality}`;
}

export function normalizeRawPrices(raw: RawPriceData[]): PriceMap {
  const map: PriceMap = {};
  for (const entry of raw) {
    if (!entry.item_id) continue;
    if (!map[entry.item_id]) map[entry.item_id] = {};
    map[entry.item_id][entry.city] = {
      itemId: entry.item_id,
      city: entry.city,
      sellMin: entry.sell_price_min,
      buyMax: entry.buy_price_max,
      updatedAt: entry.sell_price_min_date,
      buyMaxDate: entry.buy_price_max_date,
    };
  }
  return map;
}

/**
 * Fetch prices for a list of item IDs across specified locations.
 * Results are cached for 5 minutes per unique (items, locations, quality) combo.
 */
const RETRY_DELAYS_MS = [1000, 2000, 3000]; // up to 3 retries: 1s, 2s, 3s

/**
 * Inner fetch loop with partial-item retry:
 * - On each attempt, only re-requests items that are still missing from the accumulated map.
 * - Stops as soon as all items are found or retries are exhausted.
 */
async function fetchWithRetry(
  itemIds: string[],
  locations: string[],
  quality: number,
): Promise<PriceMap> {
  const accumulated: PriceMap = {};
  let remaining = [...itemIds];

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]),
      );
    }

    const raw = await window.api.fetchPrices(remaining, locations, quality);
    if (raw.length > 0) {
      const partial = normalizeRawPrices(raw);
      for (const [itemId, cities] of Object.entries(partial)) {
        accumulated[itemId] = { ...(accumulated[itemId] ?? {}), ...cities };
      }
      // Only retry for items absent from the API response entirely.
      // Items returned with price=0 are genuinely empty — don't retry those.
      remaining = remaining.filter((id) => !accumulated[id]);
      if (remaining.length === 0) break;
    }
  }

  return accumulated;
}

export async function fetchPrices(
  itemIds: string[],
  locations: string[],
  quality: number,
): Promise<PriceMap> {
  if (!itemIds.length) return {};

  const key = cacheKey(itemIds, locations, quality);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Return the same promise if a fetch for this key is already in flight.
  // This prevents duplicate API calls when calculate() is called concurrently.
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchWithRetry(itemIds, locations, quality);
  inflight.set(key, promise);
  let result: PriceMap;
  try {
    result = await promise;
  } finally {
    inflight.delete(key);
  }

  if (Object.keys(result).length > 0) {
    cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return result;
}

/** Merge multiple PriceMaps together */
export function mergePriceMaps(...maps: PriceMap[]): PriceMap {
  const result: PriceMap = {};
  for (const map of maps) {
    for (const [itemId, cities] of Object.entries(map)) {
      if (!result[itemId]) result[itemId] = {};
      Object.assign(result[itemId], cities);
    }
  }
  return result;
}

/** Get best sell price for an item across provided cities */
export function getBestSellPrice(
  priceMap: PriceMap,
  itemId: string,
  cities: string[],
): PriceEntry | null {
  const itemPrices = priceMap[itemId];
  if (!itemPrices) return null;

  let best: PriceEntry | null = null;
  for (const city of cities) {
    const entry = itemPrices[city];
    if (!entry || entry.sellMin <= 0) continue;
    if (!best || entry.sellMin < best.sellMin) {
      best = entry;
    }
  }
  return best;
}

/** Clear the local price cache (also cancels any in-flight request deduplication) */
export function clearPriceCache(): void {
  cache.clear();
  inflight.clear();
}

/** Get best buy order price (buyMax) for an item across provided cities */
export function getBestBuyPrice(
  priceMap: PriceMap,
  itemId: string,
  cities: string[],
): PriceEntry | null {
  const itemPrices = priceMap[itemId];
  if (!itemPrices) return null;

  let best: PriceEntry | null = null;
  for (const city of cities) {
    const entry = itemPrices[city];
    if (!entry || entry.buyMax <= 0) continue;
    if (!best || entry.buyMax > best.buyMax) {
      best = entry;
    }
  }
  return best;
}
