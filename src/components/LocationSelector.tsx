import React from "react";
import { CITIES, type City } from "../types";

interface Props {
  buyCity: City;
  sellCity: City;
  onBuyCityChange: (c: City) => void;
  onSellCityChange: (c: City) => void;
}

export function LocationSelector({
  buyCity,
  sellCity,
  onBuyCityChange,
  onSellCityChange,
}: Props) {
  return (
    <div className="location-selector">
      <div className="field-group">
        <label className="field-label">Buy Ingredients From</label>
        <select
          className="select-input"
          value={buyCity}
          onChange={(e) => onBuyCityChange(e.target.value as City)}
        >
          {CITIES.filter((c) => c !== "Black Market").map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">Sell Output At</label>
        <select
          className="select-input"
          value={sellCity}
          onChange={(e) => onSellCityChange(e.target.value as City)}
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
