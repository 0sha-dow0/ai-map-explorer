import React, { useState, useCallback } from 'react';
import MapShell from './components/MapShell.jsx';
import SidePanel from './components/SidePanel.jsx';
import { searchLocation, fetchAreaSummary, fetchTellMore } from './services/api.js';

const DEFAULT_CENTER = { lat: 38.5449, lng: -121.7405 }; // Davis, CA
const DEFAULT_ZOOM = 5;

export default function App() {
  // Map state
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [flyTo, setFlyTo] = useState(null);

  // Area state
  const [currentAreaKey, setCurrentAreaKey] = useState(null);
  const [placeLabel, setPlaceLabel] = useState('');
  const [city, setCity] = useState('');
  const [admin, setAdmin] = useState('');
  const [country, setCountry] = useState('');

  // Content state
  const [summary, setSummary] = useState(null);
  const [tellMore, setTellMore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tellMoreLoading, setTellMoreLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoomHint, setZoomHint] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({});

  // Markers
  const [selectedPlace, setSelectedPlace] = useState(null);

  // --- Search handler ---
  const handleSearch = useCallback(async (query) => {
    setLoading(true);
    setError(null);
    setZoomHint(false);
    setTellMore(null);
    setSummary(null);

    try {
      const result = await searchLocation(query);
      if (!result) {
        setError('Location not found. Try a different search.');
        setLoading(false);
        return;
      }

      setCity(result.city);
      setAdmin(result.admin);
      setCountry(result.country);
      setPlaceLabel(result.displayName);

      // Fly map to result
      setFlyTo({
        lat: result.lat,
        lng: result.lng,
        zoom: result.zoom,
        bounds: result.bounds || null,
      });

      // Fetch summary
      const summaryData = await fetchAreaSummary({
        centerLat: result.lat,
        centerLng: result.lng,
        zoom: result.zoom,
        filters,
        currentAreaKey: null,
      });

      if (summaryData.zoomTooLow) {
        setZoomHint(true);
        setLoading(false);
        return;
      }

      setCurrentAreaKey(summaryData.areaKey);
      setPlaceLabel(summaryData.placeLabel);
      setSummary(summaryData);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // --- Map settle handler (pan/zoom) ---
  const handleMapSettle = useCallback(async ({ lat, lng, zoom }) => {
    setZoomHint(false);
    setError(null);

    if (zoom < 9) {
      setZoomHint(true);
      return;
    }

    setLoading(true);
    setTellMore(null);

    try {
      const summaryData = await fetchAreaSummary({
        centerLat: lat,
        centerLng: lng,
        zoom,
        filters,
        currentAreaKey,
      });

      if (summaryData.sameArea) {
        setLoading(false);
        return;
      }

      if (summaryData.zoomTooLow) {
        setZoomHint(true);
        setLoading(false);
        return;
      }

      setCurrentAreaKey(summaryData.areaKey);
      setPlaceLabel(summaryData.placeLabel);
      setCity(summaryData.city || city);
      setSummary(summaryData);
    } catch (err) {
      console.error(err);
      setError('Could not load area info.');
    } finally {
      setLoading(false);
    }
  }, [filters, currentAreaKey, city]);

  // --- Tell me more handler ---
  const handleTellMore = useCallback(async () => {
    if (!currentAreaKey || !city) return;
    setTellMoreLoading(true);

    try {
      const result = await fetchTellMore({
        areaKey: currentAreaKey,
        city,
        admin,
        country,
        existingSummary: summary,
        focus: 'general',
      });
      setTellMore(result);
    } catch (err) {
      console.error(err);
    } finally {
      setTellMoreLoading(false);
    }
  }, [currentAreaKey, city, admin, country, summary]);

  // --- Filter change handler ---
  const handleFilterChange = useCallback(async (newFilters) => {
    setFilters(newFilters);

    if (!mapCenter || !currentAreaKey) return;
    setLoading(true);
    setTellMore(null);

    try {
      const summaryData = await fetchAreaSummary({
        centerLat: mapCenter.lat,
        centerLng: mapCenter.lng,
        zoom: mapZoom,
        filters: newFilters,
        currentAreaKey: null, // force refetch with new filters
      });

      if (!summaryData.zoomTooLow && !summaryData.sameArea) {
        setSummary(summaryData);
        setCurrentAreaKey(summaryData.areaKey);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mapCenter, mapZoom, currentAreaKey]);

  // --- Use my location ---
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFlyTo({ lat: latitude, lng: longitude, zoom: 12 });
        handleMapSettle({ lat: latitude, lng: longitude, zoom: 12 });
      },
      () => {
        // Permission denied → fall back to default
        setFlyTo({ ...DEFAULT_CENTER, zoom: 12 });
        handleMapSettle({ ...DEFAULT_CENTER, zoom: 12 });
      }
    );
  }, [handleMapSettle]);

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Map — 65–70% on desktop, full width on mobile */}
      <div className="flex-1 lg:flex-[2.2] relative min-h-[50vh] lg:min-h-0">
        <MapShell
          center={mapCenter}
          zoom={mapZoom}
          flyTo={flyTo}
          places={summary?.places || []}
          selectedPlace={selectedPlace}
          onSelectPlace={setSelectedPlace}
          onMapSettle={handleMapSettle}
          currentAreaKey={currentAreaKey}
          onCenterChange={setMapCenter}
          onZoomChange={setMapZoom}
        />
        {zoomHint && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-sm text-muted text-sm font-medium px-5 py-2.5 rounded-full shadow-card border border-border animate-fade-in">
            Zoom in a bit more to explore this area
          </div>
        )}
      </div>

      {/* Side panel — 30–35% on desktop, bottom sheet on mobile */}
      <div className="lg:flex-1 lg:max-w-[420px] lg:min-w-[340px] h-[50vh] lg:h-full border-t lg:border-t-0 lg:border-l border-border bg-surface shadow-panel overflow-hidden">
        <SidePanel
          placeLabel={placeLabel}
          summary={summary}
          tellMore={tellMore}
          loading={loading}
          tellMoreLoading={tellMoreLoading}
          error={error}
          filters={filters}
          selectedPlace={selectedPlace}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onTellMore={handleTellMore}
          onUseMyLocation={handleUseMyLocation}
          onSelectPlace={setSelectedPlace}
        />
      </div>
    </div>
  );
}
