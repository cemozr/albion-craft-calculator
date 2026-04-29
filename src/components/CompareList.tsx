import React from "react";
import type { CompareEntry } from "../types";
import { formatSilver, formatRoi, profitColor } from "../utils/calculator";

const QUALITY_NAMES: Record<number, string> = {
  1: "Normal",
  2: "Good",
  3: "Outstanding",
  4: "Excellent",
  5: "Masterpiece",
};

interface Props {
  entries: CompareEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function CompareList({ entries, onRemove, onClear }: Props) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>
          No items in compare list yet. Use the{" "}
          <strong>+ Add to Compare List</strong> button below any Profit Summary
          to add items here.
        </p>
      </div>
    );
  }

  return (
    <div className="compare-page">
      <div className="compare-page-header">
        <h2 className="compare-page-title">
          Compare List
          <span className="compare-page-count">{entries.length}</span>
        </h2>
        <button className="btn btn-sm btn-danger" onClick={onClear}>
          Clear All
        </button>
      </div>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quality</th>
              <th className="num">Total Cost</th>
              <th className="num">Revenue</th>
              <th className="num">Net Profit</th>
              <th className="num">ROI</th>
              <th>Parameters</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <CompareRow key={entry.id} entry={entry} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareRow({
  entry,
  onRemove,
}: {
  entry: CompareEntry;
  onRemove: (id: string) => void;
}) {
  const { result, params } = entry;
  const colorClass = profitColor(result.profit);
  const tierStr = `T${entry.tier}${entry.enchant > 0 ? `+${entry.enchant}` : ""}`;
  const qualityName = QUALITY_NAMES[params.quality] ?? "Normal";

  const returnRateLabel =
    params.manualReturnRate !== null
      ? `${(params.manualReturnRate * 100).toFixed(1)}% ✎`
      : `${(result.effectiveReturnRate * 100).toFixed(1)}%`;

  const paramBits: string[] = [
    params.hasPremium ? "Premium" : null,
    params.useFocus ? "Focus" : null,
    params.useBuyOrderMaterials ? "Buy Order" : null,
    `Return ${returnRateLabel}`,
    `Tax ${(params.marketTax * 100).toFixed(1)}%`,
    params.craftingFee > 0 ? `Fee ${formatSilver(params.craftingFee)}` : null,
    `Buy: ${params.buyCity}`,
    `Sell: ${params.sellCity}`,
    params.sellMode === "sell-now" ? "Sell Now" : "Sell Order",
  ].filter(Boolean) as string[];

  return (
    <tr>
      <td>
        <span className="compare-row__tier">{tierStr}</span>{" "}
        <span className="compare-row__name">{result.displayName}</span>
      </td>
      <td>{qualityName}</td>
      <td className="num">{formatSilver(result.totalCost)}</td>
      <td className="num">{formatSilver(result.revenue)}</td>
      <td className={`num font-bold ${colorClass}`}>
        {formatSilver(result.profit)}
      </td>
      <td className={`num font-bold ${colorClass}`}>{formatRoi(result.roi)}</td>
      <td>
        <div className="compare-param-tags">
          {paramBits.map((bit) => (
            <span key={bit} className="param-tag">
              {bit}
            </span>
          ))}
        </div>
      </td>
      <td className="date-cell">{formatAddedAt(entry.addedAt)}</td>
      <td>
        <button
          className="compare-row__remove"
          onClick={() => onRemove(entry.id)}
          title="Remove"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function formatAddedAt(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}
