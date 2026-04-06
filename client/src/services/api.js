const API_BASE = '/api';

export async function searchLocation(query) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Search failed');
  }
  return res.json();
}

export async function fetchAreaSummary({ centerLat, centerLng, zoom, filters, currentAreaKey }) {
  const res = await fetch(`${API_BASE}/area-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ centerLat, centerLng, zoom, filters, currentAreaKey }),
  });
  if (!res.ok) throw new Error('Area summary failed');
  return res.json();
}

export async function fetchTellMore({ areaKey, city, admin, country, existingSummary, focus }) {
  const res = await fetch(`${API_BASE}/tell-more`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaKey, city, admin, country, existingSummary, focus }),
  });
  if (!res.ok) throw new Error('Tell me more failed');
  return res.json();
}
