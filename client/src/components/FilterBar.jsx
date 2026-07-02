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
    Object.keys(next).forEach(k => next[k] === undefined && delete next[k]);
    onFilterChange(next);
  };

  const activeCount = Object.keys(filters).length;

  const chipClass = (active) =>
    `px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize transition-all duration-200 border ${
      active
        ? 'bg-terracotta text-paper border-terracotta shadow-card'
        : 'bg-surface text-moss border-line hover:border-line-strong hover:text-ink'
    }`;

  return (
    <div className="px-6 py-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-caps text-moss hover:text-ink transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/>
          <line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>
        </svg>
        Refine the search
        {activeCount > 0 && (
          <span className="bg-terracotta text-paper text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {activeCount}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-caps text-moss-dim mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => toggleFilter('category', cat)} className={chipClass(filters.category === cat)}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => toggleFilter('free')} className={chipClass(!!filters.free)}>
              Free entry
            </button>
            <button onClick={() => toggleFilter('familyFriendly')} className={chipClass(!!filters.familyFriendly)}>
              Family friendly
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-caps text-moss-dim mb-1.5 block">Setting</label>
            <div className="flex gap-1.5">
              {SETTINGS.map(s => (
                <button key={s} onClick={() => toggleFilter('setting', s)} className={chipClass(filters.setting === s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => onFilterChange({})}
              className="text-[11px] text-terracotta-bright hover:text-terracotta font-semibold transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
