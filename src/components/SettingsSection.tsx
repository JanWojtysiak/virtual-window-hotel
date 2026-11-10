import { useState } from 'react';
import {
  type ProviderId,
  PROVIDERS,
  loadApiKey,
  loadSelectedProvider,
  saveApiKey,
  saveSelectedProvider,
} from '../ai';

export function SettingsSection() {
  const [provider, setProvider] = useState<ProviderId>(loadSelectedProvider);
  const [apiKey, setApiKey] = useState(() => loadApiKey(loadSelectedProvider()));
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const currentProvider = PROVIDERS.find((p) => p.id === provider)!;

  const handleProviderChange = (id: ProviderId) => {
    setProvider(id);
    saveSelectedProvider(id);
    setApiKey(loadApiKey(id));
    setKeySaved(false);
  };

  const handleSaveKey = () => {
    saveApiKey(provider, apiKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <section className="w-full px-(--page-gutter) py-16">
      <p className="pixel-note mb-2.5 text-[0.75rem] font-bold tracking-[0.2em] text-accent uppercase">
        Ustawienia
      </p>
      <h1 className="mb-10 font-serif text-[length:clamp(2rem,4.5vw,3.25rem)] leading-[1.1] font-medium text-text">
        Twoja przestrzeń, Twoje zasady
      </h1>

      <article className="max-w-4xl rounded-2xl border border-border bg-surface/60 px-6 py-7 mobile:px-4">
        <h2 className="mb-2 font-serif text-[1.6rem] leading-tight font-medium text-text">
          Sztuczna inteligencja
        </h2>
        <p className="pixel-note mb-6 text-[0.85rem] leading-[1.6] text-text-soft">
          Dostawca i klucz API używane do opisu sceny w „Stwórz pokój”. Mapa głębi liczy się
          lokalnie i klucza nie potrzebuje.
        </p>

        <h3 className="mb-3 text-[0.95rem] font-semibold text-text">Dostawca</h3>
        <div
          role="radiogroup"
          aria-label="Dostawca AI"
          className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-1"
        >
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={provider === p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`cursor-pointer rounded-xl border px-5 py-4 text-left transition-all duration-200 ${
                provider === p.id
                  ? 'border-accent bg-accent/10 text-text shadow-[0_0_16px_rgb(242_181_68/0.12)]'
                  : 'border-border bg-surface text-text-soft hover:border-border-strong'
              }`}
            >
              <span className="block text-[1rem] font-semibold">{p.label}</span>
              <span className="pixel-note mt-1 block text-[0.72rem] text-text-muted">{p.description}</span>
            </button>
          ))}
        </div>

        <label
          htmlFor="settings-api-key"
          className="mt-8 mb-3 block text-[0.95rem] font-semibold text-text"
        >
          Klucz API — {currentProvider.label}
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              id="settings-api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setKeySaved(false);
              }}
              placeholder={currentProvider.apiKeyPlaceholder}
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 pr-12 text-[0.9rem] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-text-muted transition-colors hover:text-accent"
              aria-label={showKey ? 'Ukryj klucz' : 'Pokaż klucz'}
            >
              <EyeIcon crossed={showKey} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveKey}
            className="shrink-0 cursor-pointer rounded-lg bg-accent px-5 py-3 text-[0.9rem] font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            {keySaved ? 'Zapisano!' : 'Zapisz'}
          </button>
        </div>
        <p className="pixel-note mt-2 text-[0.72rem] text-text-muted">
          Klucz zapisywany jest tylko lokalnie w tej przeglądarce (localStorage).
        </p>
      </article>
    </section>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {crossed ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
