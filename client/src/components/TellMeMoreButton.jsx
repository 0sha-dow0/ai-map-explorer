import React from 'react';

export default function TellMeMoreButton({ onClick, loading }) {
  return (
    <div className="px-6 py-3">
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full py-3 px-4 bg-terracotta text-paper rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-terracotta-bright hover:shadow-glow transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:shadow-none"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-paper/30 border-t-paper animate-spin" />
            Thinking deeper...
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="16.2,7.8 13.6,13.6 7.8,16.2 10.4,10.4" fill="currentColor" stroke="none"/>
            </svg>
            Tell me more
          </>
        )}
      </button>
    </div>
  );
}
