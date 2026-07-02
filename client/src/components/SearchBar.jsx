import React, { useState } from 'react';

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a city or town..."
        className="w-full pl-10 pr-16 py-3 bg-surface border border-line rounded-xl text-sm font-body text-ink placeholder:text-moss-dim/70 focus:outline-none focus:border-terracotta/70 focus:shadow-glow transition-all duration-300"
      />
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-moss-dim" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>

      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-terracotta text-paper text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-terracotta-bright transition-colors"
      >
        Go
      </button>
    </form>
  );
}
