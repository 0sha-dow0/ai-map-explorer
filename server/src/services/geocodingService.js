import {
  getGeocodeCache, setGeocodeCache,
  getPlaceGeocodeCache, setPlaceGeocodeCache,
  getReverseGeocodeCache, setReverseGeocodeCache,
} from './cacheService.js';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'AIMapExplorer/1.0 (demo)';

/**
 * Forward geocode: query → { lat, lng, displayName, zoom }
 */
export async function geocodeSearch(query) {
  const cached = getGeocodeCache(query);
  if (cached) return { ...cached, cacheHit: true };

  const results = await searchNominatim(query);
  if (!results.length) return null;

  const r = results[0];
  const data = {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    bounds: extractBounds(r),
    displayName: formatDisplayName(r),
    city: extractCity(r),
    admin: r.address?.state || r.address?.region || '',
    country: r.address?.country || '',
    zoom: suggestZoom(r),
    raw: r,
  };

  setGeocodeCache(query, data);
  return { ...data, cacheHit: false };
}

export async function geocodePlace(name, city, admin, country) {
  const query = [name, city, admin, country].filter(Boolean).join(', ');
  const cached = getPlaceGeocodeCache(query);
  if (cached) return { ...cached, cacheHit: true };

  const results = await searchNominatim(query);
  if (!results.length) return null;

  const match = results[0];
  const data = {
    lat: parseFloat(match.lat),
    lng: parseFloat(match.lon),
    displayName: match.display_name || query,
  };

  setPlaceGeocodeCache(query, data);
  return { ...data, cacheHit: false };
}

/**
 * Reverse geocode: (lat, lng) → resolved city name + admin
 */
export async function reverseGeocode(lat, lng) {
  const cached = getReverseGeocodeCache(lat, lng);
  if (cached) return { ...cached, cacheHit: true };

  const url = new URL('/reverse', NOMINATIM_BASE);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lng);
  url.searchParams.set('format', 'json');
  url.searchParams.set('zoom', '10'); // city level
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim reverse failed: ${res.status}`);

  const r = await res.json();
  const data = {
    city: extractCity(r),
    admin: r.address?.state || r.address?.region || '',
    country: r.address?.country || '',
    displayName: formatDisplayName(r),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  };

  setReverseGeocodeCache(lat, lng, data);
  return { ...data, cacheHit: false };
}

// --- Helpers ---

function extractCity(result) {
  const a = result.address || {};
  return a.city || a.town || a.village || a.hamlet || a.municipality || a.county || 'Unknown';
}

function formatDisplayName(result) {
  const a = result.address || {};
  const city = extractCity(result);
  const state = a.state || a.region || '';
  const country = a.country || '';
  return [city, state, country].filter(Boolean).join(', ');
}

function suggestZoom(result) {
  const type = result.type || '';
  if (type === 'city') return 11.5;
  if (type === 'town') return 12;
  if (['village', 'hamlet'].includes(type)) return 13;
  if (['state', 'region'].includes(type)) return 8;
  if (['country'].includes(type)) return 5;
  return 11;
}

function extractBounds(result) {
  const box = result.boundingbox;
  if (!Array.isArray(box) || box.length !== 4) return null;

  const south = Number(box[0]);
  const north = Number(box[1]);
  const west = Number(box[2]);
  const east = Number(box[3]);

  if (![south, north, west, east].every(Number.isFinite)) {
    return null;
  }

  return {
    south,
    north,
    west,
    east,
  };
}

async function searchNominatim(query) {
  const url = new URL('/search', NOMINATIM_BASE);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);

  return res.json();
}
