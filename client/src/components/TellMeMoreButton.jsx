import React from 'react';

export default function TellMeMoreButton({ onClick, loading }) {
  return (
    <div className="px-5 py-3">
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-canvas border border-border rounded-xl text-sm font-semibold text-ink hover:bg-surface-hover hover:border-border-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-muted/30 border-t-muted animate-spin" />
            Thinking deeper...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            Tell me more
          </>
        )}
      </button>
    </div>
  );
}
