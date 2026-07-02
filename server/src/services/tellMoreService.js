import { getTellMoreCache, setTellMoreCache } from './cacheService.js';
import { generateJson } from './ai/index.js';

/**
 * Generate a deeper follow-up for an area using existing summary context.
 */
export async function getTellMore({ areaKey, city, admin, country, existingSummary, focus = 'general' }) {
  const cached = getTellMoreCache(areaKey, focus);
  if (cached) return { ...cached, cacheHit: true };

  const systemPrompt = `You are a knowledgeable travel guide AI. The user already has a basic summary and wants to learn more.
Provide a deeper, richer expansion. Tone: smart casual - engaging but grounded.
Respond with ONLY valid JSON, no markdown.`;

  const userPrompt = `The user is exploring ${city}, ${admin}, ${country}.

They already know this:
- History: ${existingSummary?.history || 'N/A'}
- Fun facts: ${existingSummary?.funFacts || 'N/A'}
- Places: ${(existingSummary?.places || []).map(p => p.name).join(', ')}

Focus area: ${focus}

Generate a deeper exploration. Respond with ONLY this JSON:
{
  "deeperHistory": "A richer paragraph about the city's history (3-5 sentences). Cover something the basic summary didn't.",
  "localVibes": "What's the local culture and vibe like? (2-4 sentences)",
  "hiddenGems": "2-3 lesser-known things worth discovering (2-4 sentences).",
  "bestTimeToVisit": "When is the best time to visit and why? (1-2 sentences)"
}`;

  const text = await generateJson({
    systemPrompt,
    userPrompt,
    maxOutputTokens: 800,
    temperature: 0.7,
  });
  let parsed;

  try {
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = {
      deeperHistory: 'More details coming soon.',
      localVibes: '',
      hiddenGems: '',
      bestTimeToVisit: '',
    };
  }

  setTellMoreCache(areaKey, focus, parsed);
  return { ...parsed, cacheHit: false };
}
