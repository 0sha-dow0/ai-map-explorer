import React, { useState } from 'react';

const CATEGORIES = ['museum', 'park', 'landmark', 'food', 'culture', 'nature', 'shopping', 'nightlife'];
const SETTINGS = ['indoor', 'outdoor', 'both'];

export default function FilterBar({ filters, onFilterChange }) {
  const [expanded, setExpanded] = useState(false);

  const toggleFilter = (key, value) => {
    const next = { ...filters };
    if (key === 'category') {
      next.category = next.category === value ? undefined : value;
    } else if (key === 'free') {
      next.free = !next.free || undefined;
    } else if (key === 'familyFriendly') {
      next.familyFriendly = !next.familyFriendly || undefined;
    } else if (key === 'setting') {
      next.setting = next.setting === value ? undefined : value;
    }
    // Clean undefined keys
    Object.keys(next).forEach(k => next[k] === undefined && delete next[k]);
    onFilterChange(next);
  };

  const activeCount = Object.keys(filters).length;

  return (
    <div className="px-5 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/>
          <line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {activeCount}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {/* Categories */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted/70 mb-1 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleFilter('category', cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${
                    filters.category === cat
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-canvas text-muted hover:bg-surface-hover border border-border'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleFilter('free')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                filters.free ? 'bg-accent text-white' : 'bg-canvas text-muted hover:bg-surface-hover border border-border'
              }`}
            >
              🆓 Free
            </button>
            <button
              onClick={() => toggleFilter('familyFriendly')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                filters.familyFriendly ? 'bg-accent text-white' : 'bg-canvas text-muted hover:bg-surface-hover border border-border'
              }`}
            >
              👨‍👩‍👧 Family
            </button>
          </div>

          {/* Setting */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted/70 mb-1 block">Setting</label>
            <div className="flex gap-1.5">
              {SETTINGS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleFilter('setting', s)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${
                    filters.setting === s
                      ? 'bg-accent text-white'
                      : 'bg-canvas text-muted hover:bg-surface-hover border border-border'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => onFilterChange({})}
              className="text-[11px] text-red-500 hover:text-red-600 font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
