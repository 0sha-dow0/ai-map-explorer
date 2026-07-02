import React from 'react';

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
      <h3 className="text-[11px] font-bold uppercase tracking-caps text-moss">{children}</h3>
      <div className="route-rule flex-1" />
    </div>
  );
}

export default function SummarySections({ history, funFacts }) {
  return (
    <div className="px-6 space-y-5">
      <section>
        <SectionLabel>History</SectionLabel>
        <p className="text-[13.5px] leading-relaxed text-ink/85">{history}</p>
      </section>

      <section>
        <SectionLabel>Fun Facts</SectionLabel>
        <p className="text-[13.5px] leading-relaxed text-ink/85">{funFacts}</p>
      </section>
    </div>
  );
}
