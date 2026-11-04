import styles from './Footer.module.css';
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
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.brandColumn}>
          <a className={styles.brand} href="./">
            <WindowIcon className={styles.logo} />
            <span>Hotel Widok</span>
          </a>
          <p className={styles.tagline}>Widok z okna, który zmienia się razem z Tobą.</p>
        </div>

        {COLUMNS.map((column) => (
          <section key={column.id} id={column.id} className={styles.column}>
            <h2 className={styles.title}>{column.title}</h2>
            <ul>
              {column.items.map((item) => (
                <li key={item}>
                  <a href="#">{item}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} Hotel Widok</span>
        <span>Hotel fikcyjny – projekt Virtual Window Hotel</span>
      </div>
    </footer>
  );
}
