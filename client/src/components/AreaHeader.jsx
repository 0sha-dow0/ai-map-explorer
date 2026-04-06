import React from 'react';

export default function AreaHeader({ label, cacheHit }) {
  return (
    <div className="px-5 pt-5 pb-2">
      <h2 className="font-display text-xl text-ink tracking-tight leading-tight">
        {label}
      </h2>
      {cacheHit && (
        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          Cached
        </span>
      )}
    </div>
  );
}
