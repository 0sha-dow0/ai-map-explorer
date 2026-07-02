# AI Map Explorer

**The map is the input.** Search for a city — or just pan the map — and the app writes a field guide for wherever you land: a short history, fun facts, and five places worth visiting, each pinned on the map.

Built with a pluggable AI backend: run it on **Groq**, **Google Gemini**, or a fully local **Ollama** model by changing one environment variable.

## Features

- 🗺️ **Map-driven exploration** — pan or search; the app reverse-geocodes the viewport and generates a summary for that area
- 🤖 **Pluggable AI providers** — Groq, Gemini, or Ollama behind a single `generateJson` contract
- 📍 **Curated places** — five diverse recommendations per city, geocoded and pinned with category-colored markers
- 🔎 **Filters** — category, free entry, family-friendly, indoor/outdoor
- 📖 **"Tell me more"** — a deeper follow-up pass: hidden gems, local vibes, best time to visit
- ⚡ **Caching** — area summaries and follow-ups are cached in-process; repeat visits are instant
- 🧪 **310 offline tests** — unit + E2E, no network and no API keys needed

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, MapLibre GL + OpenStreetMap tiles |
| Backend | Express (Node 18+, ESM) |
| AI | Groq / Google Gemini / Ollama (selectable via `AI_PROVIDER`) |
| Geocoding | Nominatim (OpenStreetMap) |
| Tests | Node's built-in `node:test` runner — zero test dependencies |

## Quick Start

### Prerequisites

- Node.js 18+ (20+ recommended)
- An API key for your chosen provider:
  - **Groq** — [console.groq.com/keys](https://console.groq.com/keys)
  - **Gemini** — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
  - **Ollama** — no key; a running local instance from [ollama.com](https://ollama.com)

### Setup

```bash
npm run install:all
cp server/.env.example server/.env
```

Edit `server/.env` and pick a provider:

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173

# gemini | groq | ollama  (default: gemini)
AI_PROVIDER=groq

GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
```

Per-provider configuration:

| Provider | Required | Optional (default) |
|---|---|---|
| `groq` | `GROQ_API_KEY` | `GROQ_MODEL` (`llama-3.3-70b-versatile`) |
| `gemini` | `GEMINI_API_KEY` | `GEMINI_MODEL` (`gemini-2.5-flash-lite`) |
| `ollama` | `OLLAMA_MODEL` | `OLLAMA_BASE_URL` (`http://localhost:11434`) |

The server validates the configuration at boot and exits with a clear error if the selected provider is missing its key.

### Run

```bash
npm run dev
```

- App: `http://localhost:5173`
- API: `http://localhost:3001` (health: `/api/health`)

## Testing

```bash
cd server && npm test
```

Runs the full suite (310 tests: provider contract, all three providers, selector, facade, and endpoint E2E) completely offline — external calls are intercepted, so no keys and no network are required.

## Deployment (Render)

The repo ships with a [`render.yaml`](render.yaml) blueprint that deploys the whole app as a **single web service**: the client is built at deploy time and served by Express alongside the API, so no CORS or extra static-site service is needed.

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, select the repo.
3. When prompted, set `GROQ_API_KEY` (and/or `GEMINI_API_KEY`). Secrets are entered in the Render dashboard — they are never committed to the repo.
4. Deploy. Render builds with `npm run install:all && npm run build` and starts with `npm start`; health checks hit `/api/health`.

Manual setup instead of the blueprint: create a **Web Service** with those same build/start commands and add the env vars from the table above (`PORT` is provided by Render automatically).

> **Note:** the `ollama` provider is for local development only — Render's environment can't reach a local Ollama instance. Use `groq` or `gemini` in production.

## Project Structure

```text
ai-map-explorer/
├── client/                      # React + Vite frontend
│   └── src/
│       ├── components/          # Map shell, side panel, place cards, ...
│       ├── hooks/               # Map movement / settle detection
│       └── services/api.js      # API client (relative /api)
├── server/                      # Express backend
│   ├── src/
│   │   ├── routes/              # /api/search, /api/area-summary, /api/tell-more, /api/health
│   │   └── services/
│   │       ├── ai/              # Provider abstraction
│   │       │   ├── providerContract.js   # Shared types, errors, validation
│   │       │   ├── geminiProvider.js
│   │       │   ├── groqProvider.js
│   │       │   ├── ollamaProvider.js
│   │       │   ├── providerSelector.js   # AI_PROVIDER registry + config checks
│   │       │   └── index.js              # generateJson facade
│   │       ├── aiSummaryService.js
│   │       ├── tellMoreService.js
│   │       ├── geocodingService.js
│   │       └── cacheService.js
│   └── test/                    # Unit + E2E suites (node:test, fully offline)
└── render.yaml                  # One-click Render blueprint
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/search?q=...` | GET | Geocode a city/town query |
| `/api/area-summary` | POST | Generate (or fetch cached) summary for coordinates |
| `/api/tell-more` | POST | Deeper follow-up for the current area |
| `/api/health` | GET | Uptime + cache statistics |

## Security Notes

- `server/.env` is **gitignored** — real keys never leave your machine.
- `server/.env.example` contains placeholders only.
- API keys live server-side only; the client talks to the relative `/api` and never sees a key.
- Provider error messages are sanitized — keys are never echoed in errors or logs.
