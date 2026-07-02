import React from 'react';

export default function LoadingState() {
  return (
    <div className="px-6 py-7 animate-fade-in">
      <div className="flex items-center gap-3 mb-7">
        <div className="w-5 h-5 rounded-full border-2 border-terracotta/25 border-t-terracotta animate-spin" />
        <p className="text-sm font-display italic text-ink/75">Charting this territory...</p>
      </div>

      <div className="space-y-6">
        <div className="skeleton h-7 w-3/4" />

        <div className="space-y-2">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
          <div className="skeleton h-3 w-4/6" />
        </div>

        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-3/4" />
        </div>

        <div className="space-y-3">
          <div className="skeleton h-3 w-28" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 items-start">
              <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-2.5 w-1/3" />
                <div className="skeleton h-2.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
