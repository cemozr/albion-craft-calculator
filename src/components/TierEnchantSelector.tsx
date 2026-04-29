import React from "react";
import type { Tier, EnchantLevel } from "../types";
import { TIERS, ENCHANT_LEVELS } from "../types";

interface Props {
  tier: Tier;
  enchant: EnchantLevel;
  onTierChange: (t: Tier) => void;
  onEnchantChange: (e: EnchantLevel) => void;
}

const ENCHANT_LABELS: Record<EnchantLevel, string> = {
  0: ".0 (Base)",
  1: ".1 (Uncommon)",
  2: ".2 (Rare)",
  3: ".3 (Exceptional)",
  4: ".4 (Legendary)",
};

export function TierEnchantSelector({
  tier,
  enchant,
  onTierChange,
  onEnchantChange,
}: Props) {
  return (
    <div className="tier-enchant">
      <div className="field-group">
        <label className="field-label">Tier</label>
        <div className="btn-group">
          {TIERS.map((t) => (
            <button
              key={t}
              className={`btn-tier${tier === t ? " btn-tier--active" : ""}`}
              onClick={() => onTierChange(t)}
            >
              T{t}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Enchantment</label>
        <select
          className="select-input"
          value={enchant}
          onChange={(e) =>
            onEnchantChange(parseInt(e.target.value, 10) as EnchantLevel)
          }
        >
          {ENCHANT_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {ENCHANT_LABELS[lvl]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
