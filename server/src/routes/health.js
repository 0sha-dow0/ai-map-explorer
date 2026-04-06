import { Router } from 'express';
import { cacheStats } from '../services/cacheService.js';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cache: cacheStats(),
    timestamp: new Date().toISOString(),
  });
});
