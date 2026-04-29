import React, { useEffect } from "react";
import type { CraftingParams } from "../types";
import { getBaseReturnRate } from "../utils/calculator";

interface Props {
  params: CraftingParams;
  onChange: (params: CraftingParams) => void;
}

export function CraftingParamsPanel({ params, onChange }: Props) {
  // Sanitize marketTax on mount in case state has a stale NaN value
  useEffect(() => {
    if (isNaN(params.marketTax)) {
      onChange({ ...params, marketTax: params.hasPremium ? 0.04 : 0.085 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof CraftingParams>(
    key: K,
    value: CraftingParams[K],
  ) {
    onChange({ ...params, [key]: value });
  }

  // When premium status changes, also update market tax to the standard rate.
  // Premium: 4% | No premium: 8.5%
  function togglePremium(checked: boolean) {
    onChange({
      ...params,
      hasPremium: checked,
      marketTax: checked ? 0.04 : 0.085,
    });
  }

  const autoRate = getBaseReturnRate(params.useFocus, params.hasPremium);
  const isManual = params.manualReturnRate !== null;
  const displayRate = isManual ? params.manualReturnRate! : autoRate;

  return (
    <div className="crafting-params">
      <h3 className="panel-title">Crafting Parameters</h3>

      <div className="params-grid">
        {/* Premium + Focus */}
        <div className="field-group">
          <span className="field-label">Account &amp; Focus</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={params.hasPremium}
              onChange={(e) => togglePremium(e.target.checked)}
            />
            Premium Account
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={params.useFocus}
              onChange={(e) => set("useFocus", e.target.checked)}
            />
            Use Focus
          </label>
          <div className="return-rate-display">
            <span className="return-rate-label">Return Rate</span>
            {isManual ? (
              <div className="return-rate-manual">
                <input
                  type="number"
                  className="text-input number-input return-rate-input"
                  min={0}
                  max={100}
                  step={0.1}
                  value={(displayRate * 100).toFixed(1)}
                  onChange={(e) =>
                    set(
                      "manualReturnRate",
                      Math.min(
                        100,
                        Math.max(0, parseFloat(e.target.value) || 0),
                      ) / 100,
                    )
                  }
                />
                <span className="unit">%</span>
              </div>
            ) : (
              <span className="return-rate-value">
                {(displayRate * 100).toFixed(1)}%
              </span>
            )}
            <label className="checkbox-label return-rate-override-label">
              <input
                type="checkbox"
                checked={isManual}
                onChange={(e) =>
                  set("manualReturnRate", e.target.checked ? autoRate : null)
                }
              />
              Manual
            </label>
          </div>
        </div>

        {/* Material Buying */}
        <div className="field-group">
          <span className="field-label">Material Buying</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={params.useBuyOrderMaterials}
              onChange={(e) => set("useBuyOrderMaterials", e.target.checked)}
            />
            Buy Order Materials
          </label>
          <div className="field-hint">
            {params.useBuyOrderMaterials
              ? "Uses buy order prices + 2.5% setup fee"
              : "Uses sell order prices (instant buy)"}
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Market Tax</label>
          <div className="input-with-unit">
            <span className="text-input number-input return-rate-value">
              {params.hasPremium ? "4.0" : "8.5"}
            </span>
            <span className="unit">%</span>
          </div>
          <div className="field-hint">
            Auto: {params.hasPremium ? "4% (premium)" : "8.5% (no premium)"}
          </div>
        </div>

        {/* Crafting Fee */}
        <div className="field-group">
          <label className="field-label">Crafting Station Fee</label>
          <div className="input-with-unit">
            <input
              type="number"
              className="text-input number-input"
              min={0}
              max={99999999}
              step={1000}
              value={params.craftingFee}
              onChange={(e) =>
                set("craftingFee", parseInt(e.target.value, 10) || 0)
              }
            />
            <span className="unit">silver</span>
          </div>
          <div className="field-hint">Flat per craft (city/guild station)</div>
        </div>
      </div>
    </div>
  );
}
