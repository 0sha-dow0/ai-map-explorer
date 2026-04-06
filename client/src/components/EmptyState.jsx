import React from 'react';

export default function EmptyState() {
  return (
    <div className="px-5 py-12 flex flex-col items-center text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>

      <h3 className="font-display text-lg text-ink mb-2">Explore any place</h3>
      <p className="text-sm text-muted leading-relaxed max-w-[260px]">
        Search for a city or move the map to discover its history, fun facts, and places worth visiting.
      </p>

      <div className="mt-6 flex flex-col gap-2 text-xs text-muted/70">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-canvas border border-border flex items-center justify-center text-[10px]">1</span>
          Search or pan to a city
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-canvas border border-border flex items-center justify-center text-[10px]">2</span>
          AI generates a smart summary
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-canvas border border-border flex items-center justify-center text-[10px]">3</span>
          Explore recommended places
        </div>
      </div>
    </div>
  );
}
