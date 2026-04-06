import NodeCache from 'node-cache';

// 30-day TTL as specified in PRD §13.2
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

const geocodeCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });
const placeGeocodeCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });
const reverseGeocodeCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });
const summaryCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });
const tellMoreCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });

// --- Geocode cache ---

export function getGeocodeCache(query) {
  const key = normalizeQuery(query);
  return geocodeCache.get(key) || null;
}

export function setGeocodeCache(query, data) {
  geocodeCache.set(normalizeQuery(query), data);
}

export function getPlaceGeocodeCache(query) {
  return placeGeocodeCache.get(normalizeQuery(query)) || null;
}

export function setPlaceGeocodeCache(query, data) {
  placeGeocodeCache.set(normalizeQuery(query), data);
}

// --- Reverse geocode cache ---

export function getReverseGeocodeCache(lat, lng) {
  const key = bucketKey(lat, lng);
  return reverseGeocodeCache.get(key) || null;
}

export function setReverseGeocodeCache(lat, lng, data) {
  reverseGeocodeCache.set(bucketKey(lat, lng), data);
}

// --- Summary cache ---

export function getSummaryCache(areaKey, filtersHash = 'none') {
  const key = `${areaKey}::${filtersHash}`;
  return summaryCache.get(key) || null;
}

export function setSummaryCache(areaKey, filtersHash = 'none', data) {
  summaryCache.set(`${areaKey}::${filtersHash}`, data);
}

// --- Tell-me-more cache ---

export function getTellMoreCache(areaKey, focus = 'general') {
  const key = `${areaKey}::${focus}`;
  return tellMoreCache.get(key) || null;
}

export function setTellMoreCache(areaKey, focus = 'general', data) {
  tellMoreCache.set(`${areaKey}::${focus}`, data);
}

// --- Utilities ---

function normalizeQuery(q) {
  return q.toLowerCase().trim().replace(/\s+/g, '_');
}

/** Bucket lat/lng to ~0.05 degree grid (~5km) per PRD §13.1 */
export function bucketKey(lat, lng) {
  const latBucket = (Math.round(lat * 20) / 20).toFixed(2);
  const lngBucket = (Math.round(lng * 20) / 20).toFixed(2);
  return `${latBucket}_${lngBucket}_city`;
}

export function cacheStats() {
  return {
    geocode: geocodeCache.getStats(),
    placeGeocode: placeGeocodeCache.getStats(),
    reverseGeocode: reverseGeocodeCache.getStats(),
    summary: summaryCache.getStats(),
    tellMore: tellMoreCache.getStats(),
  };
}
