import {
  type ProviderId,
  getProvider,
  loadApiKey,
} from './provider';

export interface SceneDescription {
  description: string;
  mood: string;
  suggestedSounds: string[];
}

export async function describeImage(
  imageBase64: string,
  providerId: ProviderId,
): Promise<SceneDescription> {
  const provider = getProvider(providerId);
  const apiKey = loadApiKey(providerId);
  if (!apiKey) {
    throw new Error(`Brak klucza API dla ${provider.label}. Ustaw go w ustawieniach AI.`);
  }

  switch (providerId) {
    case 'claude':
      return describeWithClaude(imageBase64, apiKey);
    case 'codex':
      return describeWithCodex(imageBase64, apiKey);
    case 'gemini':
      return describeWithGemini(imageBase64, apiKey);
  }
}

const SYSTEM_PROMPT = `You are an assistant for the "Virtual Window Hotel" app. Given an image, respond with JSON only:
{"description": "short scene description in Polish", "mood": "one word mood in Polish", "suggestedSounds": ["sound1", "sound2"]}
Suggest ambient sounds that fit the scene (e.g. "ptaki", "deszcz", "ruch uliczny", "wiatr").`;

async function describeWithClaude(imageBase64: string, apiKey: string): Promise<SceneDescription> {
  const mediaType = detectMediaType(imageBase64);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: stripDataUrl(imageBase64) },
            },
            { type: 'text', text: 'Opisz tę scenę i dobierz dźwięki otoczenia.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '';
  return parseJsonResponse(text);
}

async function describeWithCodex(imageBase64: string, apiKey: string): Promise<SceneDescription> {
  const mediaType = detectMediaType(imageBase64);
  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${mediaType};base64,${imageBase64}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: 'Opisz tę scenę i dobierz dźwięki otoczenia.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';
  return parseJsonResponse(text);
}

async function describeWithGemini(imageBase64: string, apiKey: string): Promise<SceneDescription> {
  const raw = stripDataUrl(imageBase64);
  const mediaType = detectMediaType(imageBase64);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mediaType, data: raw } },
              { text: 'Opisz tę scenę i dobierz dźwięki otoczenia.' },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 300 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return parseJsonResponse(text);
}

function stripDataUrl(b64: string): string {
  const idx = b64.indexOf(',');
  return idx >= 0 ? b64.slice(idx + 1) : b64;
}

function detectMediaType(b64: string): string {
  if (b64.startsWith('data:')) {
    const match = b64.match(/^data:([^;,]+)/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

function parseJsonResponse(text: string): SceneDescription {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { description: text, mood: 'neutralny', suggestedSounds: [] };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      description: String(parsed.description ?? ''),
      mood: String(parsed.mood ?? 'neutralny'),
      suggestedSounds: Array.isArray(parsed.suggestedSounds)
        ? parsed.suggestedSounds.map(String)
        : [],
    };
  } catch {
    return { description: text, mood: 'neutralny', suggestedSounds: [] };
  }
}
