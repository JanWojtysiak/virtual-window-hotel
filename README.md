# Virtual Window Hotel – Wirtualna Rzeczywistość

Aplikacja webowa pokazująca **widok z okna pokoju hotelowego**. Zamiast zwykłego zdjęcia użytkownik
ogląda scenę, która reaguje jak prawdziwe okno. Projekt powstaje jako praca zespołowa, w której
każda osoba odpowiada za inną część aplikacji.

## Zespół

| Osoba                | Zakres                          | Silnik          | Katalog  |
| -------------------- | ------------------------------- | --------------- | -------- |
| **Marcel Sutuła**    | Widoki 2D (płaskie, warstwowe)  | PixiJS          | `src/2d/` |
| **Jan Wojtysiak**    | Widoki 3D (sceny przestrzenne)  | Three.js        | `src/3d/` |

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
- **Sekcja AI** – wybór dostawcy (Claude / Codex / Gemini) i opis sceny, a także estymacja głębokości
  obrazu modelem Depth Anything V2 uruchamianym w przeglądarce.
- **Efekt paralaksy** – warstwy obrazu przesuwają się różnie w zależności od pozycji patrzącego,
  co daje wrażenie głębi.

> Projekt jest prototypem. Rezerwacja i ceny są atrapami – aplikacja nie przyjmuje płatności.

## Technologie

- TypeScript (`strict`), React 19, Vite, Tailwind CSS 4
- **PixiJS** – widoki 2D (Marcel)
- **Three.js** – widoki 3D (Jan)
- ONNX Runtime Web – model głębokości w przeglądarce
- Vitest, ESLint, Prettier

Zasady pracy z kodem i podział silników opisuje [CLAUDE.md](CLAUDE.md).

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
├── ai/          # dostawcy AI, opis sceny, model głębokości
├── components/  # nawigacja, karuzela, widok pokoju, stopka, sekcja AI
├── hooks/       # wspólne hooki React
├── scenes/      # dane pokoi (rooms.ts)
└── utils/       # funkcje pomocnicze i testy
public/assets/   # grafiki pokoi i zasoby
docs/            # opisy widoków 2D i 3D (PDF)
```

## Dokumentacja

- [docs/Okno-ze-zdjecia-2D-PixiJS.pdf](docs/Okno-ze-zdjecia-2D-PixiJS.pdf) – opis części 2D
- [docs/Okno-ze-zdjecia-3D-ThreeJS.pdf](docs/Okno-ze-zdjecia-3D-ThreeJS.pdf) – opis części 3D
