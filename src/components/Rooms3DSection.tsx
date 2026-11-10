import { sectionHref } from '../navigation';

/** Ready-made 3D rooms are not built yet; until then this points to the photo-based 3D window. */
export function Rooms3DSection() {
  return (
    <section className="w-full px-(--page-gutter) py-16">
      <p className="pixel-note mb-2.5 text-[0.75rem] font-bold tracking-[0.2em] text-accent uppercase">
        Gotowe pokoje · 3D
      </p>
      <h1 className="mb-10 font-serif text-[length:clamp(2rem,4.5vw,3.25rem)] leading-[1.1] font-medium text-text">
        Pokoje trójwymiarowe
      </h1>
      <div className="flex max-w-3xl flex-col items-start gap-5 rounded-2xl border border-dashed border-border-strong bg-surface/40 px-7 py-9">
        <p className="text-[1rem] leading-[1.6] text-text-soft">
          Gotowe sceny 3D są w przygotowaniu. Już teraz możesz zbudować trójwymiarowe okno z
          własnego zdjęcia.
        </p>
        <a
          className="rounded-full border-[1.5px] border-accent px-6 py-2.5 text-[0.85rem] font-bold tracking-[0.12em] text-accent transition-colors duration-200 hover:bg-accent hover:text-accent-ink focus-visible:bg-accent focus-visible:text-accent-ink"
          href={sectionHref('create')}
        >
          STWÓRZ POKÓJ
        </a>
      </div>
    </section>
  );
}
