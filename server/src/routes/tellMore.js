import { Router } from 'express';
import { getTellMore } from '../services/tellMoreService.js';

export const tellMoreRouter = Router();

tellMoreRouter.post('/tell-more', async (req, res) => {
  try {
    const { areaKey, city, admin, country, existingSummary, focus } = req.body;

    if (!areaKey || !city) {
      return res.status(400).json({ error: 'Missing areaKey or city' });
    }

    const result = await getTellMore({
      areaKey,
      city,
      admin: admin || '',
      country: country || '',
      existingSummary,
      focus: focus || 'general',
    });

    res.setHeader('x-cache', result.cacheHit ? 'HIT' : 'MISS');
    res.json(result);
  } catch (err) {
    console.error('Tell-more error:', err.message);
    res.status(500).json({ error: 'Failed to generate deeper content' });
  }
});
