import { useCallback, useRef, useState } from 'react';
import {
  type ProviderId,
  PROVIDERS,
  loadSelectedProvider,
  saveSelectedProvider,
  loadApiKey,
  saveApiKey,
  loadDepthModel,
  isDepthModelLoaded,
  estimateDepth,
  depthToCanvas,
  describeImage,
  type SceneDescription,
} from '../ai';

export function AiSection() {
  const [provider, setProvider] = useState<ProviderId>(loadSelectedProvider);
  const [apiKey, setApiKey] = useState(() => loadApiKey(loadSelectedProvider()));
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [depthUrl, setDepthUrl] = useState<string | null>(null);
  const [depthProgress, setDepthProgress] = useState<number | null>(null);
  const [description, setDescription] = useState<SceneDescription | null>(null);
  const [descLoading, setDescLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleProviderChange = useCallback((id: ProviderId) => {
    setProvider(id);
    saveSelectedProvider(id);
    setApiKey(loadApiKey(id));
    setKeySaved(false);
  }, []);

  const handleSaveKey = useCallback(() => {
    saveApiKey(provider, apiKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }, [provider, apiKey]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setDepthUrl(null);
    setDescription(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDepth = useCallback(async () => {
    if (!preview) return;
    setError(null);
    setDepthProgress(0);
    try {
      if (!isDepthModelLoaded()) {
        await loadDepthModel((p) => setDepthProgress(p * 0.8));
      }
      setDepthProgress(0.85);

      const img = new Image();
      img.src = preview;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Nie udało się załadować obrazu'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      setDepthProgress(0.9);
      const depthMap = await estimateDepth(imageData);
      const depthCanvas = depthToCanvas(depthMap, canvas.width, canvas.height);
      depthCanvasRef.current = depthCanvas;
      setDepthUrl(depthCanvas.toDataURL());
      setDepthProgress(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd estymacji głębi');
    } finally {
      setTimeout(() => setDepthProgress(null), 500);
    }
  }, [preview]);

  const handleDescribe = useCallback(async () => {
    if (!preview) return;
    setError(null);
    setDescLoading(true);
    try {
      const result = await describeImage(preview, provider);
      setDescription(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd opisu sceny');
    } finally {
      setDescLoading(false);
    }
  }, [preview, provider]);

  const currentProvider = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <section id="ai" className="px-(--page-gutter) py-16">
      <p className="mb-2.5 text-[0.85rem] font-bold tracking-[0.2em] text-accent uppercase">
        Sztuczna Inteligencja
      </p>
      <h2 className="mb-10 font-serif text-[length:clamp(2rem,4.5vw,3.25rem)] leading-[1.1] font-medium text-text">
        Zrób okno z własnego zdjęcia
      </h2>

      {/* Provider selector */}
      <div className="mb-8 max-w-2xl">
        <h3 className="mb-4 text-[1rem] font-semibold text-text">Provider API</h3>
        <div className="grid grid-cols-3 gap-3 mobile:grid-cols-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`cursor-pointer rounded-xl border px-5 py-4 text-left transition-all duration-200 ${
                provider === p.id
                  ? 'border-accent bg-accent/10 text-text shadow-[0_0_16px_rgb(242_181_68/0.12)]'
                  : 'border-border bg-surface text-text-soft hover:border-border-strong'
              }`}
            >
              <span className="block text-[1rem] font-semibold">{p.label}</span>
              <span className="mt-1 block text-[0.8rem] text-text-muted">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API key input */}
      <div className="mb-10 max-w-2xl">
        <label className="mb-2 block text-[0.9rem] font-medium text-text-soft">
          Klucz API — {currentProvider.label}
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setKeySaved(false);
              }}
              placeholder={currentProvider.apiKeyPlaceholder}
              className="w-full rounded-lg border border-border bg-bg-deep px-4 py-3 pr-12 text-[0.9rem] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-text-muted transition-colors hover:text-accent"
              aria-label={showKey ? 'Ukryj klucz' : 'Pokaż klucz'}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
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
        <p className="mt-2 text-[0.8rem] text-text-muted">
          Klucz zapisywany jest lokalnie w przeglądarce (localStorage). Opcjonalne — potrzebne tylko do opisu sceny przez AI.
        </p>
      </div>

      <hr className="mb-10 border-border" />

      {/* Image upload */}
      <div className="mb-8 max-w-2xl">
        <h3 className="mb-4 text-[1rem] font-semibold text-text">Wrzuć zdjęcie</h3>
        <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-10 transition-colors hover:border-accent/50 hover:bg-accent/4">
          <UploadIcon />
          <span className="text-[0.9rem] text-text-soft group-hover:text-accent">
            {file ? file.name : 'Kliknij lub przeciągnij zdjęcie (JPG / PNG)'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
      </div>

      {preview && (
        <div className="mb-8 max-w-4xl">
          <div className="grid grid-cols-2 gap-6 mobile:grid-cols-1">
            <div>
              <p className="mb-2 text-[0.85rem] font-semibold text-text-soft">Oryginał</p>
              <img
                src={preview}
                alt="Załadowane zdjęcie"
                className="w-full rounded-lg border border-border"
              />
            </div>
            <div>
              <p className="mb-2 text-[0.85rem] font-semibold text-text-soft">Mapa głębi</p>
              {depthUrl ? (
                <img
                  src={depthUrl}
                  alt="Mapa głębi"
                  className="w-full rounded-lg border border-border"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-surface">
                  <span className="text-[0.85rem] text-text-muted">
                    Kliknij &quot;Estymuj głębię&quot; poniżej
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleDepth}
              disabled={depthProgress !== null}
              className="cursor-pointer rounded-lg bg-accent px-6 py-3 text-[0.9rem] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
            >
              {depthProgress !== null
                ? `Analizuję… ${Math.round((depthProgress ?? 0) * 100)}%`
                : 'Estymuj głębię (Depth Anything V2)'}
            </button>
            <button
              type="button"
              onClick={handleDescribe}
              disabled={descLoading || !apiKey}
              className="cursor-pointer rounded-lg border border-border bg-surface px-6 py-3 text-[0.9rem] font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {descLoading ? 'Opisuję scenę…' : `Opisz scenę (${currentProvider.label})`}
            </button>
          </div>

          {depthProgress !== null && (
            <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.round((depthProgress ?? 0) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 max-w-2xl rounded-lg border border-red-500/30 bg-red-500/8 px-5 py-3 text-[0.9rem] text-red-300">
          {error}
        </div>
      )}

      {description && (
        <div className="mb-8 max-w-2xl rounded-xl border border-border bg-surface px-6 py-5">
          <h4 className="mb-2 text-[0.9rem] font-semibold text-accent">Opis sceny</h4>
          <p className="mb-3 text-[0.95rem] leading-[1.6] text-text">{description.description}</p>
          <p className="mb-2 text-[0.85rem] text-text-soft">
            <strong>Nastrój:</strong> {description.mood}
          </p>
          {description.suggestedSounds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-[0.85rem] text-text-soft">Dźwięki:</span>
              {description.suggestedSounds.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-accent/12 px-3 py-0.5 text-[0.8rem] text-accent"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted group-hover:text-accent">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}
