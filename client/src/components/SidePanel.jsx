import React from 'react';
import SearchBar from './SearchBar.jsx';
import AreaHeader from './AreaHeader.jsx';
import LoadingState from './LoadingState.jsx';
import SummarySections from './SummarySections.jsx';
import FilterBar from './FilterBar.jsx';
import PlacesList from './PlacesList.jsx';
import TellMeMoreButton from './TellMeMoreButton.jsx';
import TellMoreContent from './TellMoreContent.jsx';
import EmptyState from './EmptyState.jsx';

export default function SidePanel({
  placeLabel,
  summary,
  tellMore,
  loading,
  tellMoreLoading,
  error,
  filters,
  selectedPlace,
  onSearch,
  onFilterChange,
  onTellMore,
  onUseMyLocation,
  onSelectPlace,
}) {
  const hasContent = summary && !loading;

  return (
    <div className="h-full flex flex-col">
      {/* Masthead + search */}
      <div className="px-6 pt-6 pb-4 space-y-4 border-b border-line flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-terracotta flex items-center justify-center shadow-card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5EFE2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="16.2,7.8 13.6,13.6 7.8,16.2 10.4,10.4" fill="#F5EFE2" stroke="none"/>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-xl font-medium tracking-tight text-ink leading-none">
              AI Map Explorer
            </h1>
            <p className="text-[10px] uppercase tracking-caps text-moss-dim font-semibold mt-1">
              Field notes for anywhere
            </p>
          </div>
        </div>

        <SearchBar onSearch={onSearch} />

        <button
          onClick={onUseMyLocation}
          className="flex items-center gap-1.5 text-xs font-semibold text-moss hover:text-terracotta-bright transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
          </svg>
          Use my location
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {error && (
          <div className="mx-6 mt-5 p-3.5 bg-terracotta-deep/15 border border-terracotta-deep/40 rounded-xl text-sm text-terracotta-bright animate-fade-in">
            {error}
          </div>
        )}

        {loading && <LoadingState />}

        {!loading && !summary && !error && <EmptyState />}

        {hasContent && (
          <div>
            <div className="animate-rise-1">
              <AreaHeader label={placeLabel} cacheHit={summary.cacheHit} />
            </div>
            <div className="animate-rise-2">
              <SummarySections history={summary.history} funFacts={summary.funFacts} />
            </div>

            <div className="animate-rise-3">
              <FilterBar filters={filters} onFilterChange={onFilterChange} />
            </div>

            <div className="animate-rise-4">
              <PlacesList
                intro={summary.placesIntro}
                places={summary.places}
                selectedPlace={selectedPlace}
                onSelectPlace={onSelectPlace}
              />
            </div>

            <div className="animate-rise-5">
              {!tellMore && (
                <TellMeMoreButton onClick={onTellMore} loading={tellMoreLoading} />
              )}

              {tellMore && <TellMoreContent data={tellMore} />}
            </div>

            <div className="h-10" />
          </div>
        )}
      </div>
    </div>
  );
}
