import { useState } from 'react';
import styles from './Navbar.module.css';
import { WindowIcon } from './WindowIcon';

const NAV_LINKS = [
  { label: 'Apartament', href: '?room=apartment' },
  { label: 'Jak to działa', href: '#jak-to-dziala' },
  { label: 'Kontakt', href: '#kontakt' },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={styles.navbar}>
      <a className={styles.brand} href="./">
        <WindowIcon className={styles.logo} />
        <span>Hotel Widok</span>
      </a>

      <button
        type="button"
        className={styles.menuToggle}
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="main-nav" className={`${styles.nav} ${menuOpen ? styles.open : ''}`}>
        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <a className={styles.cta} href="#pokoje" onClick={closeMenu}>
          Zarezerwuj
        </a>
      </nav>
    </header>
  );
}
