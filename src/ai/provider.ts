export type ProviderId = 'claude' | 'codex' | 'gemini';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  description: string;
  apiKeyName: string;
  /** Placeholder shown in the API-key input. */
  apiKeyPlaceholder: string;
}

export const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    description: 'Claude API — opis sceny, dobór dźwięków i klimatu',
    apiKeyName: 'ANTHROPIC_API_KEY',
    apiKeyPlaceholder: 'sk-ant-api03-…',
  },
  {
    id: 'codex',
    label: 'Codex (OpenAI)',
    description: 'OpenAI API — opis sceny i generowanie treści',
    apiKeyName: 'OPENAI_API_KEY',
    apiKeyPlaceholder: 'sk-…',
  },
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    description: 'Google Gemini API — analiza obrazu i opis',
    apiKeyName: 'GEMINI_API_KEY',
    apiKeyPlaceholder: 'AIza…',
  },
];

export function getProvider(id: ProviderId): ProviderConfig {
  const p = PROVIDERS.find((p) => p.id === id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

const STORAGE_PROVIDER_KEY = 'ai-provider';
const STORAGE_API_KEY_PREFIX = 'ai-apikey-';

export function loadSelectedProvider(): ProviderId {
  try {
    const stored = localStorage.getItem(STORAGE_PROVIDER_KEY);
    if (stored && PROVIDERS.some((p) => p.id === stored)) return stored as ProviderId;
  } catch {
    /* localStorage unavailable */
  }
  return 'claude';
}

export function saveSelectedProvider(id: ProviderId): void {
  try {
    localStorage.setItem(STORAGE_PROVIDER_KEY, id);
  } catch {
    /* localStorage unavailable */
  }
}

export function loadApiKey(id: ProviderId): string {
  try {
    return localStorage.getItem(STORAGE_API_KEY_PREFIX + id) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(id: ProviderId, key: string): void {
  try {
    if (key) {
      localStorage.setItem(STORAGE_API_KEY_PREFIX + id, key);
    } else {
      localStorage.removeItem(STORAGE_API_KEY_PREFIX + id);
    }
  } catch {
    /* localStorage unavailable */
  }
}
