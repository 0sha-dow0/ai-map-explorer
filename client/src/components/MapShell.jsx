import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapMovement } from '../hooks/useMapMovement.js';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// Marker color per category — warm expedition palette matching the journal panel
const CATEGORY_COLORS = {
  museum: '#9C6BB3',
  park: '#5E8C5A',
  landmark: '#D9A441',
  food: '#C95B38',
  culture: '#C26188',
  nature: '#3E7C6B',
  shopping: '#5B6FA8',
  nightlife: '#7D5BA6',
  default: '#D96F47',
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
        border: 3px solid #F7F0E1;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(20,31,25,0.35);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex; align-items: center; justify-content: center;
        animation-delay: ${idx * 90}ms;
      `;
      visual.innerHTML = `<span style="color:#F7F0E1;font-size:13px;font-weight:700;font-family:'Albert Sans',sans-serif;">${idx + 1}</span>`;
      el.appendChild(visual);

      el.addEventListener('mouseenter', () => {
        visual.style.transform = 'scale(1.25)';
        visual.style.boxShadow = '0 4px 18px rgba(20,31,25,0.4)';
      });
      el.addEventListener('mouseleave', () => {
        visual.style.transform = 'scale(1)';
        visual.style.boxShadow = '0 2px 10px rgba(20,31,25,0.35)';
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(mapRef.current);

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelectPlace(place);

        if (popupRef.current) popupRef.current.remove();
        const popup = new maplibregl.Popup({ offset: 20, closeOnClick: true })
          .setLngLat([place.lng, place.lat])
          .setHTML(`
            <div style="font-family:'Albert Sans',sans-serif;">
              <div style="font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:600;font-size:15px;margin-bottom:4px;color:#2A241A;">${place.name}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:${color};font-weight:700;margin-bottom:6px;">${place.category}</div>
              <div style="font-size:12.5px;color:#5C5342;line-height:1.5;">${place.whyVisit}</div>
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
