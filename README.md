# Virtual Window Hotel – Wirtualna Rzeczywistość

Aplikacja webowa pokazująca **widok z okna pokoju hotelowego**. Zamiast zwykłego zdjęcia użytkownik
ogląda scenę, która reaguje jak prawdziwe okno. Projekt powstaje jako praca zespołowa, w której
każda osoba odpowiada za inną część aplikacji.

## Zespół

| Osoba             | Zakres                         | Silnik   | Katalog   |
| ----------------- | ------------------------------ | -------- | --------- |
| **Marcel Sutuła** | Widoki 2D (płaskie, warstwowe) | PixiJS   | `src/2d/` |
| **Jan Wojtysiak** | Widoki 3D (sceny przestrzenne) | Three.js | `src/3d/` |

Wspólne elementy (strona główna, nawigacja, karuzela pokoi, sekcja AI, stylowanie Tailwind) leżą poza
tymi katalogami w `src/components/`, `src/scenes/` i `src/ai/`.

## Co robi projekt

- **Strona główna** – nawigacja, automatycznie przewijana karuzela pokoi z cenami za noc (dane przykładowe)
  oraz stopka.
- **Widok pokoju** (`?room=<id>`) – pełnoekranowy widok z oknem. Dostępne są cztery typy widoków:
  1. **Ogród** – przyroda, chmury i korony drzew,
  2. **Miasto** – ulice, ruch, światła wieczorem,
  3. **Apartament** – wnętrze pokoju na pierwszym planie (kot, akwarium, robot sprzątający),
  4. **Reklama hotelu** – tryb billboardu, który sam przełącza widoki.
- **Pora dnia** – świt, dzień, zachód, noc; każdy pokój ma swoją domyślną porę.
- **Efekt paralaksy** – warstwy obrazu przesuwają się różnie w zależności od pozycji patrzącego,
  co daje wrażenie głębi.
- **Sekcja AI** – opisana niżej.

> Projekt jest prototypem. Rezerwacja i ceny są atrapami – aplikacja nie przyjmuje płatności.

## AI w projekcie

Sekcja AI (`src/ai/`, `src/components/AiSection.tsx`) służy do **analizy zdjęcia** wgranego przez
użytkownika. Ma dwa narzędzia, które działają na tym samym obrazie.

### Jak korzystać

1. Przejdź do sekcji **AI** na stronie głównej.
2. Wgraj zdjęcie widoku (kliknięcie lub przeciągnięcie pliku w obszar wgrywania).
3. Wybierz narzędzie:
   - **Głębia** – oblicza mapę głębi obrazu i pokazuje ją jako obraz w skali szarości.
     Nie wymaga klucza API.
   - **Opis sceny** – wysyła zdjęcie do wybranego dostawcy AI i zwraca opis, nastrój oraz
     sugerowane dźwięki otoczenia. Wymaga klucza API.

### Narzędzie 1: Głębia (lokalnie, w przeglądarce)

- Model **Depth Anything V3 Small** (ONNX, fp32, ok. 105 MB) jest pobierany z Hugging Face przy
  pierwszym użyciu i zapamiętywany w czasie działania strony.
- Obliczenia wykonuje ONNX Runtime Web (backend WASM) – zdjęcie **nie opuszcza przeglądarki**.
- Wynik to mapa „bliskości” 0–1, która może posłużyć do podziału obrazu na warstwy paralaksy
  (bliższe obiekty przesuwają się mocniej).

### Narzędzie 2: Opis sceny (dostawca zewnętrzny)

Wybór dostawcy w panelu „Provider API”:

| Dostawca          | Model                 | Klucz w panelu         |
| ----------------- | --------------------- | ---------------------- |
| Claude (Anthropic) | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| Codex (OpenAI)    | `gpt-4o-mini`         | `OPENAI_API_KEY`       |
| Gemini (Google)   | `gemini-2.0-flash`    | `GEMINI_API_KEY`       |

- Klucz API wpisuje się w aplikacji; jest zapisywany w `localStorage` przeglądarki (osobno dla
  każdego dostawcy) i wysyłany **bezpośrednio z przeglądarki** do API dostawcy.
- Model dostaje prompt systemowy i zwraca JSON: `description` (opis sceny po polsku), `mood`
  (nastrój jednym słowem) oraz `suggestedSounds` (np. „ptaki”, „deszcz”, „ruch uliczny”).
- Odpowiedź, która nie jest poprawnym JSON-em, jest traktowana jako zwykły tekst opisu.
- Bez klucza API aplikacja pokazuje komunikat, zamiast wysyłać zapytanie.

### Zastosowanie w projekcie

Wynik analizy ma służyć jako dane wejściowe dla widoków: mapa głębi – do paralaksy, a opis
i sugerowane dźwięki – do doboru klimatu i dźwięków otoczenia pokoju.

### Ograniczenia i uwagi

- Klucze API są przechowywane w przeglądarce użytkownika – nie wpisuj tu kluczy produkcyjnych
  ani nie wdrażaj tej konfiguracji publicznie bez backendu, który ukryje klucz.
- Pierwsze uruchomienie narzędzia „Głębia” wymaga pobrania modelu (ok. 105 MB).
- Wersja modelu w interfejsie i w kodzie powinna być zgodna; opis w nagłówku sekcji mówi o V2,
  a kod ładuje V3 Small.

## Technologie

- TypeScript (`strict`), React 19, Vite, Tailwind CSS 4
- **PixiJS** – widoki 2D (Marcel)
- **Three.js** – widoki 3D (Jan)
- ONNX Runtime Web – model głębi w przeglądarce
- Vitest, ESLint, Prettier

## Uruchomienie

Wymagany jest Node.js LTS.

```bash
npm install
npm run dev       # serwer deweloperski
npm run build     # sprawdzenie typów i build produkcyjny
npm run lint      # ESLint
npm test          # testy Vitest
```

## Struktura

```
src/
├── 2d/          # widoki PixiJS (Marcel Sutuła)
├── 3d/          # widoki Three.js (Jan Wojtysiak)
├── ai/          # dostawcy AI, opis sceny, model głębi
├── components/  # nawigacja, karuzela, widok pokoju, stopka, sekcja AI
├── hooks/       # wspólne hooki React
├── scenes/      # dane pokoi (rooms.ts)
└── utils/       # funkcje pomocnicze i testy
public/assets/   # grafiki pokoi i zasoby
```
