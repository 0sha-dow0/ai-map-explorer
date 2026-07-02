import React from 'react';

export default function AreaHeader({ label, cacheHit }) {
  return (
    <div className="px-6 pt-6 pb-3">
      <p className="text-[10px] uppercase tracking-caps text-terracotta font-bold mb-1.5">
        Now exploring
      </p>
      <h2 className="font-display italic font-medium text-[26px] text-ink tracking-tight leading-snug">
        {label}
      </h2>
      <div className="flex items-center gap-3 mt-3">
        <div className="route-rule flex-1" />
        {cacheHit && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-caps text-gold border border-gold/40 px-2 py-0.5 rounded-full -rotate-2">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            From the archive
          </span>
        )}
      </div>
    </div>
  );
}
