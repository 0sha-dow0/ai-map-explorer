import React from 'react';

export default function LoadingState() {
  return (
    <div className="px-5 py-6 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-5 h-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        <p className="text-sm font-medium text-ink/70">Finding places worth checking out...</p>
      </div>

      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="skeleton h-6 w-3/4" />

        {/* History skeleton */}
        <div className="space-y-2">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
          <div className="skeleton h-3 w-4/6" />
        </div>

        {/* Fun facts skeleton */}
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-3/4" />
        </div>

        {/* Places skeleton */}
        <div className="space-y-2">
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
