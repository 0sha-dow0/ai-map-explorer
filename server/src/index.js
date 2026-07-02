import { loadEnv } from './loadEnv.js';
import { createApp } from './app.js';
import { assertProviderConfigured } from './services/ai/index.js';

const DEFAULT_PORT = 3001;

loadEnv();

try {
  assertProviderConfigured(process.env);
} catch (err) {
  console.error(`AI provider configuration error: ${err.message}`);
  process.exit(1);
}

const app = createApp();
const PORT = process.env.PORT || DEFAULT_PORT;

app.listen(PORT, () => {
  console.log(`\n  🗺️  AI Map Explorer API`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Health: http://localhost:${PORT}/api/health\n`);
});
