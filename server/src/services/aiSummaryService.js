import { getSummaryCache, setSummaryCache } from './cacheService.js';
import { generateJson } from './geminiService.js';
import { geocodePlace } from './geocodingService.js';

const PROMPT_VERSION = 'v1.0';

/**
 * Generate or retrieve a cached area summary.
 * Returns { history, funFacts, placesIntro, places[], areaKey, cacheHit }
 */
export async function getAreaSummary({ city, admin, country, lat, lng, areaKey, filters }) {
  const filtersHash = filters ? JSON.stringify(filters) : 'none';
  const cached = getSummaryCache(areaKey, filtersHash);
  if (cached) return { ...cached, cacheHit: true };

  const filterInstructions = buildFilterInstructions(filters);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ city, admin, country, lat, lng, filterInstructions });

  const text = await generateJson({
    systemPrompt,
    userPrompt,
    maxOutputTokens: 1200,
    temperature: 0.6,
  });
  const parsed = await parseResponse(text, city, admin, country);

  const result = {
    ...parsed,
    areaKey,
    promptVersion: PROMPT_VERSION,
  };

  setSummaryCache(areaKey, filtersHash, result);
  return { ...result, cacheHit: false };
}

// ---- Prompt builders ----

function buildSystemPrompt() {
  return `You are a knowledgeable and engaging travel guide AI for the AI Map Explorer app.
You produce structured JSON responses about cities and towns.
Your tone is smart casual - lively and interesting, but not childish or over-the-top.
Keep all text concise. History and fun facts should each be a short paragraph (2-4 sentences).
Each recommended place needs a genuine reason to visit, not generic filler.
Stay factual. If you're uncertain, use safer wording rather than guessing.
Avoid controversial or sensitive topics unless clearly relevant and safe.
ALWAYS respond with valid JSON only - no markdown, no backticks, no extra text.`;
}

function buildUserPrompt({ city, admin, country, lat, lng, filterInstructions }) {
  return `Generate a location summary for:

City/Town: ${city}
Region: ${admin}
Country: ${country}
Coordinates: ${lat}, ${lng}
${filterInstructions}

Respond with ONLY this JSON structure:
{
  "history": "A short paragraph about the city's history (2-4 sentences).",
  "funFacts": "A short paragraph of fun/interesting facts (2-4 sentences).",
  "placesIntro": "A single intro sentence for recommended places.",
  "places": [
    {
      "name": "Place Name",
      "category": "museum|park|landmark|food|culture|nature|shopping|nightlife",
      "whyVisit": "One sentence explaining why this place is worth visiting.",
      "lat": 0.0,
      "lng": 0.0,
      "free": true,
      "familyFriendly": true,
      "setting": "indoor|outdoor|both"
    }
  ]
}

Include exactly 5 places. Make them diverse across categories.
Place coordinates should be real and accurate for that city.
Each "whyVisit" must be specific to the place, not generic.`;
}

function buildFilterInstructions(filters) {
  if (!filters) return '';
  const parts = [];
  if (filters.category) parts.push(`Focus on category: ${filters.category}`);
  if (filters.free === true) parts.push('Prefer free places.');
  if (filters.familyFriendly === true) parts.push('Prefer family-friendly places.');
  if (filters.setting) parts.push(`Prefer ${filters.setting} places.`);
  return parts.length ? `\nFilter preferences:\n${parts.join('\n')}` : '';
}

// ---- Response parser ----

async function parseResponse(text, cityFallback, admin, country) {
  try {
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const data = JSON.parse(clean);
    const places = await Promise.all((data.places || []).map(async (p) => {
      const geocoded = await geocodePlace(p.name || 'Unknown', cityFallback, admin, country).catch(() => null);

      return {
        name: p.name || 'Unknown',
        category: p.category || 'landmark',
        whyVisit: p.whyVisit || '',
        lat: geocoded?.lat ?? p.lat ?? 0,
        lng: geocoded?.lng ?? p.lng ?? 0,
        free: p.free ?? false,
        familyFriendly: p.familyFriendly ?? true,
        setting: p.setting || 'both',
      };
    }));

    return {
      history: data.history || '',
      funFacts: data.funFacts || '',
      placesIntro: data.placesIntro || '',
      places,
    };
  } catch (err) {
    console.error('Failed to parse AI response:', err.message);
    return {
      history: `${cityFallback} has a rich and fascinating history waiting to be explored.`,
      funFacts: `There's always something surprising to discover about ${cityFallback}.`,
      placesIntro: `Here are some places worth checking out:`,
      places: [],
    };
  }
}
