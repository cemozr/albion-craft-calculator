import React from "react";
import type { CraftResult } from "../types";
import { formatSilver, formatRoi, profitColor } from "../utils/calculator";

interface Props {
  result: CraftResult;
  quality: number;
  sellMode: "sell-order" | "sell-now";
  onQualityChange: (q: number) => void;
  onSellModeChange: (m: "sell-order" | "sell-now") => void;
  onAddToCompare?: () => void;
}

export function ResultsTable({
  result,
  quality,
  sellMode,
  onQualityChange,
  onSellModeChange,
  onAddToCompare,
}: Props) {
  const colorClass = profitColor(result.profit);

  return (
    <div className="results">
      {/* Ingredient breakdown */}
      <div className="results__section">
        <h3 className="panel-title">Ingredients</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>ID</th>
              <th className="num">Qty</th>
              <th className="num">Unit Price</th>
              <th className="num">Total</th>
              <th>City</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {result.ingredientCosts.map((ic) => (
              <tr
                key={ic.ingredient.itemId}
                className={ic.missingPrice ? "row-warn" : ""}
              >
                <td>{ic.ingredient.displayName}</td>
                <td className="id-cell">{ic.ingredient.itemId}</td>
                <td className="num">
                  {ic.ingredient.quantity.toLocaleString()}
                </td>
                <td className="num">
                  {ic.missingPrice ? (
                    <span className="missing-price">No price</span>
                  ) : (
                    formatSilver(ic.unitPrice)
                  )}
                </td>
                <td className="num">
                  {ic.missingPrice ? "—" : formatSilver(ic.totalCost)}
                </td>
                <td>{ic.priceCity}</td>
                <td className="date-cell">{formatDate(ic.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="results__section results__summary">
        <div className="summary-header">
          <h3 className="panel-title">Profit Summary</h3>
          <div className="summary-sell-mode">
            <button
              className={`btn btn-sm${sellMode === "sell-order" ? " btn-active" : ""}`}
              onClick={() => onSellModeChange("sell-order")}
            >
              Sell Order
            </button>
            <button
              className={`btn btn-sm${sellMode === "sell-now" ? " btn-active" : ""}`}
              onClick={() => onSellModeChange("sell-now")}
            >
              Sell Now
            </button>
          </div>
          <div className="summary-quality">
            <span className="summary-quality-label">Sell quality</span>
            <select
              className="select-input select-input--sm"
              value={quality}
              onChange={(e) => onQualityChange(parseInt(e.target.value, 10))}
            >
              <option value={1}>Normal</option>
              <option value={2}>Good</option>
              <option value={3}>Outstanding</option>
              <option value={4}>Excellent</option>
              <option value={5}>Masterpiece</option>
            </select>
          </div>
        </div>
        {result.missingPrices && (
          <div className="alert alert-warn">
            ⚠ Some prices are unavailable. Results may be incomplete.
          </div>
        )}
        <div className="summary-grid">
          <SummaryRow
            label="Total ingredient cost"
            value={formatSilver(result.totalIngredientCost)}
          />
          <SummaryRow
            label={`Effective cost (${(result.effectiveReturnRate * 100).toFixed(1)}% return)`}
            value={formatSilver(result.effectiveCost)}
          />
          <SummaryRow
            label="Crafting fee"
            value={formatSilver(result.craftingFee)}
          />
          {result.buyOrderSetupFee > 0 && (
            <SummaryRow
              label="Buy order setup fee (2.5%)"
              value={formatSilver(result.buyOrderSetupFee)}
            />
          )}
          {result.sellOrderSetupFee > 0 && (
            <SummaryRow
              label="Sell order setup fee (2.5%)"
              value={formatSilver(result.sellOrderSetupFee)}
            />
          )}
          <SummaryRow
            label="Total cost"
            value={formatSilver(result.totalCost)}
            bold
          />
          <div className="summary-divider" />
          <SummaryRow
            label={
              sellMode === "sell-now"
                ? "Instant sell price (buy order)"
                : "Sell price (min sell order)"
            }
            value={formatSilver(result.sellPrice)}
          />
          <SummaryRow
            label="Revenue (after market tax)"
            value={formatSilver(result.revenue)}
          />
          <div className="summary-divider" />
          <SummaryRow
            label="Net Profit"
            value={formatSilver(result.profit)}
            className={colorClass}
            bold
          />
          <SummaryRow
            label="ROI"
            value={formatRoi(result.roi)}
            className={colorClass}
            bold
          />
        </div>
        {onAddToCompare && (
          <button className="btn-compare" onClick={onAddToCompare}>
            + Add to Compare List
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`summary-row${bold ? " summary-row--bold" : ""}${className ? ` ${className}` : ""}`}
    >
      <span className="summary-label">{label}</span>
      <span className="summary-value">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso || iso.startsWith("0001")) return "—";
  try {
    // Append 'Z' if no timezone info so it's treated as UTC everywhere
    const normalized = /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return "—";
    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return "just now"; // clock skew
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  } catch {
    return "—";
  }
}
