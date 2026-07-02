import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { searchRouter } from './routes/search.js';
import { areaSummaryRouter } from './routes/areaSummary.js';
import { tellMoreRouter } from './routes/tellMore.js';
import { healthRouter } from './routes/health.js';
import { requestLogger } from './middleware/logger.js';

const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';
const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

/**
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', healthRouter);
  app.use('/api', searchRouter);
  app.use('/api', areaSummaryRouter);
  app.use('/api', tellMoreRouter);

  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  return app;
}
