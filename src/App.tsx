import React, { useState, useEffect, useCallback } from "react";
import type {
  Tier,
  EnchantLevel,
  ItemsMap,
  PriceMap,
  CraftResult,
  CraftingParams,
  CompareEntry,
  City,
} from "./types";
import {
  loadItems,
  loadRecipes,
  resolveRecipe,
  clearRecipeCache,
} from "./services/recipeService";
import {
  fetchPrices,
  clearPriceCache,
  mergePriceMaps,
} from "./services/priceService";
import { calculateProfit } from "./utils/calculator";
import { ItemSearch } from "./components/ItemSearch";
import { TierEnchantSelector } from "./components/TierEnchantSelector";
import { LocationSelector } from "./components/LocationSelector";
import { CraftingParamsPanel } from "./components/CraftingParamsPanel";
import { ResultsTable } from "./components/ResultsTable";
import { CompareList } from "./components/CompareList";
import { ToastContainer } from "./components/Toast";
import type { ToastItem } from "./components/Toast";

const DEFAULT_PARAMS: CraftingParams = {
  hasPremium: true,
  useFocus: false,
  useBuyOrderMaterials: false,
  manualReturnRate: null,
  marketTax: 0.04,
  craftingFee: 0,
  craftingCity: "Caerleon",
  sellCity: "Caerleon",
  buyCity: "Caerleon",
  quality: 1,
  sellMode: "sell-order",
};

type LoadState =
  | "idle"
  | "loading-items"
  | "loading-recipes"
  | "ready"
  | "error";

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [items, setItems] = useState<ItemsMap>({});
  const [rawRecipes, setRawRecipes] = useState<Record<string, unknown>>({});

  const [selectedItemKey, setSelectedItemKey] = useState("");
  const [tier, setTier] = useState<Tier>(4);
  const [enchant, setEnchant] = useState<EnchantLevel>(0);
  const [params, setParams] = useState<CraftingParams>(DEFAULT_PARAMS);

  const [result, setResult] = useState<CraftResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [compareList, setCompareList] = useState<CompareEntry[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastId = React.useRef(0);

  function pushToast(message: string) {
    const id = ++nextToastId.current;
    setToasts((prev) => [...prev, { id, message }]);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Load items + recipes on mount ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        setLoadState("loading-items");
        const loadedItems = await loadItems();
        setItems(loadedItems);

        setLoadState("loading-recipes");
        const loaded = await loadRecipes();
        setRawRecipes(loaded);

        setLoadState("ready");
      } catch (err) {
        setLoadError(String(err));
        setLoadState("error");
      }
    }
    init();
  }, []);

  // ── Calculate whenever inputs change ──────────────────────────────────────
  const calculate = useCallback(async () => {
    if (!selectedItemKey || loadState !== "ready") return;

    // Strip tier prefix from selectedItemKey if present (e.g. "T4_2H_CLAYMORE" → "2H_CLAYMORE")
    const baseKey = selectedItemKey.replace(/^T\d+_/, "");

    const recipe = resolveRecipe(tier, enchant, baseKey, rawRecipes, items);
    if (!recipe) {
      setCalcError(
        `No recipe found for T${tier}_${baseKey}${enchant > 0 ? "@" + enchant : ""}`,
      );
      setResult(null);
      return;
    }
    setCalcError("");

    setCalculating(true);
    try {
      // Collect item IDs: crafted item fetched at sell quality, ingredients at Normal (1)
      const ingredientIds = recipe.ingredients.map((i) => i.itemId);

      const [sellPrices, ingredientPrices] = await Promise.all([
        fetchPrices([recipe.itemId], [params.sellCity], params.quality),
        ingredientIds.length
          ? fetchPrices(ingredientIds, [params.buyCity], 1)
          : Promise.resolve({} as PriceMap),
      ]);
      const fresh = mergePriceMaps(ingredientPrices, sellPrices);
      setLastFetch(new Date());

      const craftResult = calculateProfit(recipe, fresh, params, items);
      setResult(craftResult);
    } catch (err) {
      setCalcError(String(err));
    } finally {
      setCalculating(false);
    }
  }, [selectedItemKey, tier, enchant, params, rawRecipes, items, loadState]);

  // Recalculate when key inputs change (debounced via useEffect)
  useEffect(() => {
    if (!selectedItemKey) {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => {
      calculate();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedItemKey,
    tier,
    enchant,
    params.buyCity,
    params.sellCity,
    params.quality,
    params.hasPremium,
    params.useFocus,
    params.useBuyOrderMaterials,
    params.manualReturnRate,
    params.craftingFee,
    params.sellMode,
  ]);

  function handleAddToCompare() {
    if (!result) return;
    const entry: CompareEntry = {
      id: `${Date.now()}-${result.itemId}`,
      tier,
      enchant,
      params: { ...params },
      result,
      addedAt: Date.now(),
    };
    setCompareList((prev) => [entry, ...prev]);
    pushToast(`${result.displayName} added to compare list`);
  }

  async function handleRefresh() {
    clearPriceCache();
    await calculate();
  }

  async function handleClearCache() {
    clearPriceCache();
    clearRecipeCache();
    setResult(null);
    setItems({});
    setRawRecipes({});
    await window.api.clearCache();
    // Re-init
    setLoadState("loading-items");
    try {
      const loadedItems = await loadItems();
      setItems(loadedItems);
      setLoadState("loading-recipes");
      const loaded = await loadRecipes();
      setRawRecipes(loaded);
      setLoadState("ready");
    } catch (err) {
      setLoadError(String(err));
      setLoadState("error");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadState === "loading-items" || loadState === "loading-recipes") {
    return (
      <div className="splash">
        <div className="spinner" />
        <p>
          {loadState === "loading-items"
            ? "Loading item database…"
            : "Loading recipes (this may take a moment on first launch)…"}
        </p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="splash splash--error">
        <p>Failed to load game data:</p>
        <pre>{loadError}</pre>
        <button className="btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <header className="app-header">
        <h1 className="app-title">Albion Craft Calculator</h1>
        <div className="header-actions">
          {lastFetch && !showCompare && (
            <span className="last-fetch">
              Prices updated: {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <button
            className={`btn btn-sm${showCompare ? " btn-active" : ""}`}
            onClick={() => setShowCompare((v) => !v)}
          >
            Compare List
            {compareList.length > 0 ? ` (${compareList.length})` : ""}
          </button>
          {!showCompare && (
            <button
              className="btn btn-sm"
              onClick={handleRefresh}
              disabled={calculating}
            >
              {calculating ? "Fetching…" : "↻ Refresh Prices"}
            </button>
          )}
          <button
            className="btn btn-sm btn-danger"
            onClick={handleClearCache}
            title="Clear all cached data and re-download"
          >
            Clear Cache
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* ── Left panel: controls ── */}
        <aside className="sidebar">
          <div className="card">
            <ItemSearch
              items={items}
              selectedItemKey={selectedItemKey}
              onSelect={setSelectedItemKey}
              disabled={loadState !== "ready"}
            />
          </div>

          <div className="card">
            <TierEnchantSelector
              tier={tier}
              enchant={enchant}
              onTierChange={setTier}
              onEnchantChange={setEnchant}
            />
          </div>

          <div className="card">
            <LocationSelector
              buyCity={params.buyCity as City}
              sellCity={params.sellCity as City}
              onBuyCityChange={(c) =>
                setParams((p) => ({ ...p, buyCity: c, craftingCity: c }))
              }
              onSellCityChange={(c) =>
                setParams((p) => ({ ...p, sellCity: c }))
              }
            />
          </div>

          <div className="card">
            <CraftingParamsPanel params={params} onChange={setParams} />
          </div>
        </aside>

        {/* ── Right panel: results ── */}
        <main className="main-content">
          {showCompare ? (
            <CompareList
              entries={compareList}
              onRemove={(id) =>
                setCompareList((prev) => prev.filter((e) => e.id !== id))
              }
              onClear={() => setCompareList([])}
            />
          ) : (
            <>
              {calcError && (
                <div className="alert alert-error">{calcError}</div>
              )}
              {!selectedItemKey && (
                <div className="empty-state">
                  <p>Search for an item to see crafting profit analysis.</p>
                </div>
              )}
              {selectedItemKey && calculating && !result && (
                <div className="empty-state">
                  <div className="spinner" />
                  <p>Fetching prices…</p>
                </div>
              )}
              {result && (
                <div className="results-wrap">
                  {calculating && (
                    <div className="results-loading-overlay">
                      <div className="spinner" />
                    </div>
                  )}
                  <ResultsTable
                    result={result}
                    quality={params.quality}
                    sellMode={params.sellMode}
                    onQualityChange={(q) =>
                      setParams((p) => ({ ...p, quality: q }))
                    }
                    onSellModeChange={(m) =>
                      setParams((p) => ({ ...p, sellMode: m }))
                    }
                    onAddToCompare={handleAddToCompare}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
