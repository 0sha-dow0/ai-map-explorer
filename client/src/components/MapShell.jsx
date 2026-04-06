import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapMovement } from '../hooks/useMapMovement.js';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// Marker color per category
const CATEGORY_COLORS = {
  museum: '#8B5CF6',
  park: '#10B981',
  landmark: '#F59E0B',
  food: '#EF4444',
  culture: '#EC4899',
  nature: '#059669',
  shopping: '#6366F1',
  nightlife: '#7C3AED',
  default: '#2563EB',
};

export default function MapShell({
  center,
  zoom,
  flyTo,
  places,
  selectedPlace,
  onSelectPlace,
  onMapSettle,
  currentAreaKey,
  onCenterChange,
  onZoomChange,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);
  const isUserInteraction = useRef(false);

  const { handleMoveEnd } = useMapMovement({ onMapSettle, currentAreaKey });

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [TILE_URL],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [center.lng, center.lat],
      zoom: zoom,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.once('load', () => map.resize());

    // Track user-initiated movement
    map.on('dragstart', () => { isUserInteraction.current = true; });
    map.on('zoomstart', () => { isUserInteraction.current = true; });

    map.on('moveend', () => {
      const c = map.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
      onZoomChange(map.getZoom());

      if (isUserInteraction.current) {
        handleMoveEnd(map);
        isUserInteraction.current = false;
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle flyTo commands
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    isUserInteraction.current = false;

    if (flyTo.bounds) {
      const { west, south, east, north } = flyTo.bounds;
      mapRef.current.fitBounds(
        [[west, south], [east, north]],
        {
          padding: { top: 48, right: 48, bottom: 48, left: 48 },
          duration: 1800,
          essential: true,
          maxZoom: flyTo.zoom || 12,
        }
      );
      return;
    }

    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom || 12,
      duration: 1800,
      essential: true,
    });
  }, [flyTo]);

  // Render markers for places
  useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!mapRef.current || !places.length) return;

    places.forEach((place, idx) => {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;

      const color = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.default;

      // MapLibre controls the root marker transform for positioning.
      // Keep visual scaling on an inner node so hover/selection does not
      // override the library's translate() styles and send markers drifting.
      const el = document.createElement('div');
      el.className = 'map-marker';
      el.style.cssText = `
        cursor: pointer;
      `;

      const visual = document.createElement('div');
      visual.className = 'map-marker-visual';
      visual.style.cssText = `
        width: 32px; height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex; align-items: center; justify-content: center;
      `;
      visual.innerHTML = `<span style="color:white;font-size:13px;font-weight:700;">${idx + 1}</span>`;
      el.appendChild(visual);

      el.addEventListener('mouseenter', () => {
        visual.style.transform = 'scale(1.25)';
        visual.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
      });
      el.addEventListener('mouseleave', () => {
        visual.style.transform = 'scale(1)';
        visual.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(mapRef.current);

      el.addEventListener('click', () => {
        onSelectPlace(place);

        if (popupRef.current) popupRef.current.remove();
        const popup = new maplibregl.Popup({ offset: 20, closeOnClick: true })
          .setLngLat([place.lng, place.lat])
          .setHTML(`
            <div style="font-family:'Plus Jakarta Sans',sans-serif;">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${place.name}</div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${color};font-weight:600;margin-bottom:6px;">${place.category}</div>
              <div style="font-size:13px;color:#4B5563;line-height:1.4;">${place.whyVisit}</div>
            </div>
          `)
          .addTo(mapRef.current);

        popupRef.current = popup;
      });

      markersRef.current.push(marker);
    });
  }, [places, onSelectPlace]);

  // Highlight selected place
  useEffect(() => {
    markersRef.current.forEach((marker, idx) => {
      const el = marker.getElement();
      const visual = el.firstElementChild;
      const place = places[idx];
      if (!visual) return;

      if (selectedPlace && place && selectedPlace.name === place.name) {
        visual.style.transform = 'scale(1.35)';
        el.style.zIndex = '10';
      } else {
        visual.style.transform = 'scale(1)';
        el.style.zIndex = '1';
      }
    });
  }, [selectedPlace, places]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
