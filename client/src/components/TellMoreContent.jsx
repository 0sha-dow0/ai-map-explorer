import React from 'react';

export default function TellMoreContent({ data }) {
  if (!data) return null;

  const sections = [
    { icon: '🏛️', label: 'Deeper History', content: data.deeperHistory },
    { icon: '🎭', label: 'Local Vibes', content: data.localVibes },
    { icon: '💎', label: 'Hidden Gems', content: data.hiddenGems },
    { icon: '🗓️', label: 'Best Time to Visit', content: data.bestTimeToVisit },
  ].filter(s => s.content);

  return (
    <div className="px-5 py-3 animate-slide-up">
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Going Deeper</h3>
          {data.cacheHit && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Cached
            </span>
          )}
        </div>

        <div className="space-y-3">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-canvas rounded-xl p-3 border border-border/60">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{section.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{section.label}</span>
              </div>
              <p className="text-sm text-ink/75 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
