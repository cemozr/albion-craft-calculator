import React, { useState, useRef, useEffect, useMemo } from "react";
import type { ItemsMap } from "../types";

interface Props {
  items: ItemsMap;
  selectedItemKey: string;
  onSelect: (itemKey: string) => void;
  disabled?: boolean;
}

export function ItemSearch({
  items,
  selectedItemKey,
  onSelect,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Tier-based name prefixes assigned by Albion to each item (T2–T8).
  // We strip these so only the base item name is shown.
  const TIER_NAME_PREFIX =
    /^(Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's)\s+/i;

  // Deduplicated base items: strip tier prefix (T4_, T5_…) and enchant suffix (@1, @2…)
  // so each unique item type appears exactly once in the dropdown.
  const baseItems = useMemo(() => {
    const map = new Map<string, string>(); // baseKey → display name
    for (const [id, name] of Object.entries(items)) {
      if (/@\d+$/.test(id)) continue; // skip enchanted variants
      const baseKey = id.replace(/^T\d+_/, "");
      if (!map.has(baseKey)) {
        map.set(baseKey, name.replace(TIER_NAME_PREFIX, ""));
      }
    }
    return map;
  }, [items]);

  const selectedName = selectedItemKey
    ? (baseItems.get(selectedItemKey) ?? selectedItemKey)
    : "";

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results: { key: string; name: string }[] = [];
    for (const [key, name] of baseItems) {
      if (name.toLowerCase().includes(q)) {
        results.push({ key, name });
      }
      if (results.length >= 80) break;
    }
    return results;
  }, [query, baseItems]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleSelect(key: string) {
    onSelect(key);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onSelect("");
    setQuery("");
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="item-search">
      <label className="field-label">Item</label>
      <div className="item-search__field">
        {selectedItemKey && !open ? (
          <div className="item-search__selected">
            <span className="item-search__selected-name">{selectedName}</span>
            <button
              className="btn-icon"
              onClick={handleClear}
              title="Clear"
              disabled={disabled}
            >
              ✕
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="text-input"
            placeholder="Search item name…"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            autoComplete="off"
          />
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="item-search__dropdown">
          {filtered.map(({ key, name }) => (
            <li
              key={key}
              className={`item-search__option${key === selectedItemKey ? " item-search__option--selected" : ""}`}
              onMouseDown={() => handleSelect(key)}
            >
              <span className="item-search__option-name">{name}</span>
            </li>
          ))}
        </ul>
      )}
      {open && query.length > 0 && filtered.length === 0 && (
        <div className="item-search__empty">No items found</div>
      )}
    </div>
  );
}
