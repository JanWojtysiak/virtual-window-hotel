import { WindowIcon } from './WindowIcon';

// Placeholder content – to be replaced with real sections later.
const COLUMNS = [
  {
    id: 'hotel',
    title: 'Hotel',
    items: ['O nas', 'Pokoje', 'Galeria', 'Regulamin'],
  },
  {
    id: 'jak-to-dziala',
    title: 'Jak to działa',
    items: ['Okno z paralaksą', 'Pora dnia i pogoda', 'Sterowanie widokiem', 'Tryb reklamy'],
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    items: ['recepcja@hotel-widok.example', '+48 000 000 000', 'ul. Przykładowa 1, 00-000 Miasto'],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-deep px-(--page-gutter) pt-14 pb-7 text-text-muted">
      <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-10 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
        <div className="max-[900px]:col-span-full">
          <a
            className="inline-flex items-center gap-3 font-serif text-[1.6rem] font-semibold text-text"
            href="./"
          >
            <WindowIcon className="size-6 text-accent" />
            <span>Wirtualna Rzeczywistość</span>
          </a>
          <p className="mt-3.5 max-w-[28ch] leading-[1.6]">
            Widok z okna, który zmienia się razem z Tobą.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <section key={column.id} id={column.id}>
            <h2 className="mb-4 text-[0.85rem] font-bold tracking-[0.16em] text-text uppercase">
              {column.title}
            </h2>
            <ul className="grid gap-2.5">
              {column.items.map((item) => (
                <li key={item}>
                  <a
                    className="wrap-anywhere transition-colors duration-200 hover:text-accent focus-visible:text-accent"
                    href="#"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-[0.875rem]">
        <span>© {new Date().getFullYear()} Wirtualna Rzeczywistość</span>
        <span>Hotel fikcyjny – projekt Virtual Window Hotel</span>
      </div>
    </footer>
  );
}
