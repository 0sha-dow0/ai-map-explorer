import React from 'react';

const STEPS = [
  'Search or pan to a city',
  'AI writes the field notes',
  'Explore recommended places',
];

export default function EmptyState() {
  return (
    <div className="px-6 py-14 flex flex-col items-center text-center animate-fade-in">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full border border-line" />
        <div className="absolute inset-2 rounded-full border border-dashed border-line-strong animate-compass-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2562F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="16.2,7.8 13.6,13.6 7.8,16.2 10.4,10.4" fill="#C2562F" stroke="none"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </div>
      </div>

      <h3 className="font-display italic text-2xl font-medium text-ink mb-2.5">
        Explore any place
      </h3>
      <p className="text-[13px] text-moss leading-relaxed max-w-[270px]">
        Search for a city or move the map to discover its history, fun facts, and places worth visiting.
      </p>

      <div className="mt-8 flex flex-col gap-3 text-xs text-moss items-start">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-surface border border-line flex items-center justify-center text-[10px] font-bold text-terracotta-bright">
              {idx + 1}
            </span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
