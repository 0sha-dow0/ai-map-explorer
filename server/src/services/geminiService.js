const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export async function generateJson({ systemPrompt, userPrompt, maxOutputTokens, temperature = 0.7 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const url = new URL(`models/${model}:generateContent`, GEMINI_API_BASE);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const apiMessage = data?.error?.message || `Gemini request failed with status ${response.status}`;
    throw new Error(apiMessage);
  }

  const text = data?.candidates
    ?.flatMap(candidate => candidate.content?.parts || [])
    ?.map(part => part.text || '')
    ?.join('')
    ?.trim();

  if (!text) {
    throw new Error('Gemini returned no text content');
  }

  return text;
}
