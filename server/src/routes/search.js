import { Router } from 'express';
import { geocodeSearch } from '../services/geocodingService.js';

export const searchRouter = Router();

searchRouter.get('/search', async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

    const result = await geocodeSearch(q);
    if (!result) return res.status(404).json({ error: 'Location not found' });

    res.setHeader('x-cache', result.cacheHit ? 'HIT' : 'MISS');
    res.json({
      lat: result.lat,
      lng: result.lng,
      bounds: result.bounds,
      displayName: result.displayName,
      city: result.city,
      admin: result.admin,
      country: result.country,
      zoom: result.zoom,
      cacheHit: result.cacheHit,
    });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});
