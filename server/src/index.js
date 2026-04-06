import express from 'express';
import cors from 'cors';
import { searchRouter } from './routes/search.js';
import { areaSummaryRouter } from './routes/areaSummary.js';
import { tellMoreRouter } from './routes/tellMore.js';
import { healthRouter } from './routes/health.js';
import { requestLogger } from './middleware/logger.js';
import { loadEnv } from './loadEnv.js';

loadEnv();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api', healthRouter);
app.use('/api', searchRouter);
app.use('/api', areaSummaryRouter);
app.use('/api', tellMoreRouter);

app.listen(PORT, () => {
  console.log(`\n  🗺️  AI Map Explorer API`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Health: http://localhost:${PORT}/api/health\n`);
});
