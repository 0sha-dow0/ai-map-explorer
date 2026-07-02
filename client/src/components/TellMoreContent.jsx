import React from 'react';

const SECTION_META = [
  { key: 'deeperHistory', label: 'Deeper History' },
  { key: 'localVibes', label: 'Local Vibes' },
  { key: 'hiddenGems', label: 'Hidden Gems' },
  { key: 'bestTimeToVisit', label: 'Best Time to Visit' },
];

export default function TellMoreContent({ data }) {
  if (!data) return null;

  const sections = SECTION_META
    .map(meta => ({ ...meta, content: data[meta.key] }))
    .filter(s => s.content);

  return (
    <div className="px-6 py-3">
      <div className="border-t border-line pt-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
          <h3 className="text-[11px] font-bold uppercase tracking-caps text-gold-soft">Going Deeper</h3>
          <div className="route-rule flex-1" />
          {data.cacheHit && (
            <span className="text-[9.5px] font-bold uppercase tracking-caps text-gold border border-gold/40 px-2 py-0.5 rounded-full -rotate-2">
              From the archive
            </span>
          )}
        </div>

        <div className="space-y-3">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-surface/70 rounded-xl p-4 border border-line">
              <span className="text-[10px] font-bold uppercase tracking-caps text-moss block mb-1.5">
                {section.label}
              </span>
              <p className="text-[13px] text-ink/80 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
