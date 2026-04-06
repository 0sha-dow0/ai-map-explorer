import { useRef, useCallback, useEffect } from 'react';

const DEBOUNCE_MS = 1800; // PRD: 1.5–2 seconds
const MIN_ZOOM = 9;

/**
 * Manages debounced map movement detection.
 * Calls onMapSettle(center, zoom) after the user stops panning/zooming.
 */
export function useMapMovement({ onMapSettle, currentAreaKey }) {
  const timerRef = useRef(null);
  const lastAreaKeyRef = useRef(currentAreaKey);

  useEffect(() => {
    lastAreaKeyRef.current = currentAreaKey;
  }, [currentAreaKey]);

  const handleMoveEnd = useCallback((map) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const center = map.getCenter();
      const zoom = map.getZoom();

      if (zoom < MIN_ZOOM) return; // zoom gating

      onMapSettle({ lat: center.lat, lng: center.lng, zoom });
    }, DEBOUNCE_MS);
  }, [onMapSettle]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { handleMoveEnd, MIN_ZOOM };
}
