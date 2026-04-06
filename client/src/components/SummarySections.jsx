import React from 'react';

export default function SummarySections({ history, funFacts }) {
  return (
    <div className="px-5 space-y-4 animate-slide-up">
      {/* History */}
      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">📜</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">History</h3>
        </div>
        <p className="text-sm leading-relaxed text-ink/80">{history}</p>
      </section>

      {/* Fun Facts */}
      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">✨</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Fun Facts</h3>
        </div>
        <p className="text-sm leading-relaxed text-ink/80">{funFacts}</p>
      </section>
    </div>
  );
}
