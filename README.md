# AI Map Explorer

The map is the input. Search for a city or pan the map, and the app generates a location summary with history, fun facts, and places to visit.

## Stack

- React + Vite
- MapLibre GL with OpenStreetMap tiles
- Express
- Google Gemini API
- Nominatim geocoding

## Quick Start

### Prerequisites

- Node.js 18+
- Gemini API key from `https://aistudio.google.com/app/apikey`

### Setup

```bash
npm run install:all
cp server/.env.example server/.env
```

Update `server/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
```

Run the app:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/api/health`

## Project Structure

```text
ai-map-explorer/
|-- client/
|   |-- src/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- services/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |   `-- index.css
|   |-- index.html
|   `-- vite.config.js
|-- server/
|   |-- src/
|   |   |-- middleware/
|   |   |-- routes/
|   |   `-- services/
|   `-- .env.example
|-- package.json
`-- README.md
```

## API Endpoints

- `GET /api/search?q=...`
- `POST /api/area-summary`
- `POST /api/tell-more`
- `GET /api/health`

## Notes

- OpenStreetMap tiles are configured in [MapShell.jsx](c:\Users\shadow\Downloads\ai-map-explorer\ai-map-explorer\client\src\components\MapShell.jsx).
- Gemini calls are handled in [geminiService.js](c:\Users\shadow\Downloads\ai-map-explorer\ai-map-explorer\server\src\services\geminiService.js).
