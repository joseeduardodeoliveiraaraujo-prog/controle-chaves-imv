import { useState, useRef, useEffect, useMemo } from "react";

export default function SearchableSelect({
  id,
  label,
  placeholder,
  emptyMessage,
  options,
  value,
  onChange,
  searchFields,
  getIcon,
  getTitle,
  getSubtitle,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      searchFields.some((field) =>
        String(o[field] ?? "").toLowerCase().includes(q)
      )
    );
  }, [options, searchTerm, searchFields]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeSearch();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [searchTerm]);

  useEffect(() => {
    if (searchActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchActive]);

  function closeSearch() {
    setOpen(false);
    setSearchActive(false);
    setSearchTerm("");
  }

  function openSearch() {
    setSearchActive(true);
    setSearchTerm("");
    setOpen(true);
    if (inputRef.current) inputRef.current.focus();
  }

  function handleSelect(option) {
    onChange(option.id);
    closeSearch();
    if (inputRef.current) inputRef.current.blur();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeSearch();
      return;
    }
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
        e.preventDefault();
        openSearch();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlight];
      if (option) handleSelect(option);
    }
  }

  const showSearchInput = searchActive || !selected;

  return (
    <div className="searchable-select" ref={containerRef}>
      <label htmlFor={id}>{label}</label>
      <div className="searchable-select-field">
        {showSearchInput && (
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={searchTerm}
            placeholder={placeholder}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setSearchActive(false)}
            autoComplete="off"
            required={!selected}
          />
        )}

        {!showSearchInput && selected && (
          <button
            type="button"
            className="searchable-select-display"
            onClick={() => {
              setSearchActive(true);
              setSearchTerm("");
              setOpen(true);
            }}
          >
            <span className="searchable-select-value-icon">{getIcon(selected)}</span>
            <span className="searchable-select-value-text">{getTitle(selected)}</span>
            <span className="searchable-select-caret" aria-hidden="true">▾</span>
          </button>
        )}
      </div>

      {open && (
        <ul className="searchable-select-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="searchable-select-empty">{emptyMessage}</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={highlight === index}
                className={`searchable-select-item ${
                  highlight === index ? "highlighted" : ""
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
              >
                <span className="searchable-select-item-icon">
                  {getIcon(option)}
                </span>
                <span className="searchable-select-item-text">
                  <span className="searchable-select-item-title">
                    {getTitle(option)}
                  </span>
                  {getSubtitle(option) && (
                    <span className="searchable-select-item-sub">
                      {getSubtitle(option)}
                    </span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
