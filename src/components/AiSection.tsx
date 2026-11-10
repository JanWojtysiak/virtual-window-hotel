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
  DEPTH_MODEL_INFO,
  describeImage,
  type SceneDescription,
} from '../ai';
import type { DepthMeshSource } from '../3d';
import { DepthRelief } from './DepthRelief';

type PreviewMode = '2d' | '3d';

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

  const [depthSource, setDepthSource] = useState<DepthMeshSource | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('3d');
  const [depthScale, setDepthScale] = useState(0.35);
  const [smoothing, setSmoothing] = useState(2);

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
    setDepthSource(null);
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
      // The same depth map feeds both previews (2D layers and 3D relief).
      setDepthSource({ image: img, depth: depthMap, width: canvas.width, height: canvas.height });
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
    <section id="ai" className="w-full px-(--page-gutter) py-16">
      <p className="mb-2.5 text-[0.85rem] font-bold tracking-[0.2em] text-accent uppercase">
        Sztuczna Inteligencja
      </p>
      <h2 className="mb-10 font-serif text-[length:clamp(2rem,4.5vw,3.25rem)] leading-[1.1] font-medium text-text">
        Zrób okno z własnego zdjęcia
      </h2>

      {/* Image upload (shared by all AI tools) */}
      <div className="mb-10">
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

      {/* AI #1 – depth estimation */}
      <article className="mb-10 rounded-2xl border border-border bg-surface/60 px-6 py-7 mobile:px-4">
        <p className="mb-1 text-[0.8rem] font-bold tracking-[0.18em] text-accent uppercase">
          AI nr 1
        </p>
        <h3 className="mb-2 font-serif text-[1.6rem] leading-tight font-medium text-text">
          Głębia (Depth Anything V2)
        </h3>
        <p className="mb-1 text-[0.95rem] leading-[1.6] text-text-soft">
          Dla każdego piksela ocenia, jak daleko jest od aparatu. Jasne miejsca są blisko, ciemne –
          daleko. Z tej mapy da się potem pociąć zdjęcie na warstwy paralaksy.
        </p>
        <p className="mb-6 text-[0.8rem] text-text-muted">
          Model: {DEPTH_MODEL_INFO.name}, {DEPTH_MODEL_INFO.precision}, ok.{' '}
          {DEPTH_MODEL_INFO.sizeMb} MB – pobierany przy pierwszym użyciu i liczony lokalnie w
          przeglądarce (zdjęcie nigdzie nie jest wysyłane).
        </p>

        {preview ? (
          <>
            <div className="grid grid-cols-2 gap-6 mobile:grid-cols-1">
              <figure>
                <figcaption className="mb-2 text-[0.85rem] font-semibold text-text-soft">
                  Oryginał
                </figcaption>
                <img
                  src={preview}
                  alt="Załadowane zdjęcie"
                  className="w-full rounded-lg border border-border"
                />
              </figure>
              <figure>
                <figcaption className="mb-2 text-[0.85rem] font-semibold text-text-soft">
                  Mapa głębi
                </figcaption>
                {depthUrl ? (
                  <img
                    src={depthUrl}
                    alt="Mapa głębi"
                    className="w-full rounded-lg border border-border"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-bg-deep">
                    <span className="text-[0.85rem] text-text-muted">
                      Kliknij &quot;Estymuj głębię&quot; poniżej
                    </span>
                  </div>
                )}
              </figure>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleDepth}
                disabled={depthProgress !== null}
                className="cursor-pointer rounded-lg bg-accent px-6 py-3 text-[0.9rem] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
              >
                {depthProgress !== null
                  ? `Analizuję… ${Math.round(depthProgress * 100)}%`
                  : 'Estymuj głębię'}
              </button>
              {depthUrl && (
                <span className="flex items-center gap-2 text-[0.8rem] text-text-muted">
                  daleko
                  <span className="h-2.5 w-28 rounded-full bg-linear-to-r from-black to-white" />
                  blisko
                </span>
              )}
            </div>

            {depthProgress !== null && (
              <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-bg-deep">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.round(depthProgress * 100)}%` }}
                />
              </div>
            )}

            {depthSource && (
              <div className="mt-8">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="text-[0.9rem] font-semibold text-text">Podgląd:</span>
                  <div
                    role="radiogroup"
                    aria-label="Rodzaj podglądu"
                    className="inline-flex rounded-lg border border-border bg-bg-deep p-1"
                  >
                    {(
                      [
                        ['2d', '2D (warstwy)'],
                        ['3d', '3D (płaskorzeźba)'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={previewMode === mode}
                        onClick={() => setPreviewMode(mode)}
                        className={`cursor-pointer rounded-md px-4 py-2 text-[0.85rem] font-semibold transition-colors ${
                          previewMode === mode
                            ? 'bg-accent text-accent-ink'
                            : 'text-text-soft hover:text-accent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {previewMode === '3d' ? (
                  <>
                    <DepthRelief
                      source={depthSource}
                      depthScale={depthScale}
                      smoothing={smoothing}
                    />
                    <div className="mt-4 grid max-w-2xl grid-cols-2 gap-6 mobile:grid-cols-1">
                      <label className="text-[0.85rem] text-text-soft">
                        Siła głębi: {depthScale.toFixed(2)}
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={depthScale}
                          onChange={(e) => setDepthScale(Number(e.target.value))}
                          className="mt-2 block w-full accent-accent"
                        />
                      </label>
                      <label className="text-[0.85rem] text-text-soft">
                        Wygładzenie: {smoothing}
                        <input
                          type="range"
                          min={0}
                          max={8}
                          step={1}
                          value={smoothing}
                          onChange={(e) => setSmoothing(Number(e.target.value))}
                          className="mt-2 block w-full accent-accent"
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-[0.8rem] text-text-muted">
                      Rusz myszką nad obrazem – kamera Three.js obraca się wokół płaskorzeźby.
                    </p>
                  </>
                ) : (
                  <div className="flex aspect-video max-h-[70vh] w-full items-center justify-center rounded-lg border border-border bg-bg-deep px-6 text-center">
                    <span className="text-[0.85rem] text-text-muted">
                      Podgląd 2D – cięcie zdjęcia na warstwy paralaksy (PixiJS) jest w
                      przygotowaniu.
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-[0.85rem] text-text-muted">Najpierw wrzuć zdjęcie powyżej.</p>
        )}
      </article>

      {/* Scene description via an LLM provider */}
      <article className="mb-10 rounded-2xl border border-border bg-surface/60 px-6 py-7 mobile:px-4">
        <h3 className="mb-4 font-serif text-[1.6rem] leading-tight font-medium text-text">
          Opis sceny
        </h3>

        <div className="grid grid-cols-2 gap-8 mobile:grid-cols-1">
          <div>
            <h4 className="mb-3 text-[0.95rem] font-semibold text-text">Provider API</h4>
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

          <div>
            <label className="mb-3 block text-[0.95rem] font-semibold text-text">
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
              Klucz zapisywany jest lokalnie w przeglądarce (localStorage). Potrzebny tylko do opisu
              sceny.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDescribe}
          disabled={!preview || descLoading || !apiKey}
          className="mt-6 cursor-pointer rounded-lg border border-border bg-surface px-6 py-3 text-[0.9rem] font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {descLoading ? 'Opisuję scenę…' : `Opisz scenę (${currentProvider.label})`}
        </button>

        {description && (
          <div className="mt-6 rounded-xl border border-border bg-bg-deep px-6 py-5">
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
      </article>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/8 px-5 py-3 text-[0.9rem] text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-text-muted group-hover:text-accent"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}
