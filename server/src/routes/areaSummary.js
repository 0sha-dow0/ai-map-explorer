import { Router } from 'express';
import { reverseGeocode } from '../services/geocodingService.js';
import { getAreaSummary } from '../services/aiSummaryService.js';
import { bucketKey } from '../services/cacheService.js';

export const areaSummaryRouter = Router();

areaSummaryRouter.post('/area-summary', async (req, res) => {
  try {
    const { centerLat, centerLng, zoom, filters, currentAreaKey } = req.body;
    const lat = Number(centerLat);
    const lng = Number(centerLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Missing centerLat/centerLng' });
    }

    // Zoom gating - only city level (>= 9)
    if (zoom && zoom < 9) {
      return res.status(200).json({
        hint: 'Zoom in a bit more to explore this area',
        zoomTooLow: true,
      });
    }

    // Generate area key from bucketed coordinates
    const areaKey = bucketKey(lat, lng);

    // Skip if same area
    if (currentAreaKey && currentAreaKey === areaKey) {
      return res.status(200).json({ sameArea: true, areaKey });
    }

    // Reverse geocode to get city name
    const geo = await reverseGeocode(lat, lng);

    // Generate or fetch cached summary
    const summary = await getAreaSummary({
      city: geo.city,
      admin: geo.admin,
      country: geo.country,
      lat,
      lng,
      areaKey,
      filters,
    });

    res.setHeader('x-cache', summary.cacheHit ? 'HIT' : 'MISS');
    res.json({
      areaKey,
      placeLabel: geo.displayName,
      city: geo.city,
      history: summary.history,
      funFacts: summary.funFacts,
      placesIntro: summary.placesIntro,
      places: summary.places,
      cacheHit: summary.cacheHit,
    });
  } catch (err) {
    console.error('Area summary error:', err.message);
    res.status(500).json({ error: 'Failed to generate area summary' });
  }
});
