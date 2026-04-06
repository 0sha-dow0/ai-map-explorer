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
      {/* Search area */}
      <div className="px-5 pt-5 pb-3 space-y-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/>
            </svg>
          </div>
          <h1 className="font-display text-lg tracking-tight text-ink">AI Map Explorer</h1>
        </div>

        <SearchBar onSearch={onSearch} />

        <button
          onClick={onUseMyLocation}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-dark transition-colors"
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
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
            {error}
          </div>
        )}

        {loading && <LoadingState />}

        {!loading && !summary && !error && <EmptyState />}

        {hasContent && (
          <div className="animate-fade-in">
            <AreaHeader label={placeLabel} cacheHit={summary.cacheHit} />
            <SummarySections history={summary.history} funFacts={summary.funFacts} />

            <FilterBar filters={filters} onFilterChange={onFilterChange} />

            <PlacesList
              intro={summary.placesIntro}
              places={summary.places}
              selectedPlace={selectedPlace}
              onSelectPlace={onSelectPlace}
            />

            {!tellMore && (
              <TellMeMoreButton onClick={onTellMore} loading={tellMoreLoading} />
            )}

            {tellMore && <TellMoreContent data={tellMore} />}

            <div className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
