import { useState } from 'react';
import { WindowIcon } from './WindowIcon';

const NAV_LINKS = [
  { label: 'Pokoje 2D', href: '#pokoje' },
  { label: 'Pokoje 3D', href: '#pokoje-3d' },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-10 flex h-(--navbar-height) items-center justify-between gap-6 border-b border-border bg-bg/92 px-(--page-gutter) backdrop-blur-[10px]">
      <a
        className="inline-flex items-center gap-[18px] font-serif text-[2rem] font-semibold tracking-[0.01em] whitespace-nowrap text-text mobile:gap-3 mobile:text-[1.6rem]"
        href="./"
      >
        <WindowIcon className="size-8 text-accent mobile:size-[26px]" />
        <span>Wirtualna Rzeczywistość</span>
      </a>

      <button
        type="button"
        className="group hidden size-11 cursor-pointer flex-col justify-center gap-[5px] rounded-[10px] p-2.5 mobile:flex"
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="block h-0.5 rounded-xs bg-text transition-[translate,rotate,opacity] duration-250 group-aria-expanded:translate-y-[7px] group-aria-expanded:rotate-45" />
        <span className="block h-0.5 rounded-xs bg-text transition-[translate,rotate,opacity] duration-250 group-aria-expanded:opacity-0" />
        <span className="block h-0.5 rounded-xs bg-text transition-[translate,rotate,opacity] duration-250 group-aria-expanded:-translate-y-[7px] group-aria-expanded:-rotate-45" />
      </button>

      <nav
        id="main-nav"
        className={`flex items-center gap-9 mobile:absolute mobile:inset-x-0 mobile:top-full mobile:flex-col mobile:items-stretch mobile:gap-5 mobile:border-b mobile:border-border mobile:bg-bg mobile:px-(--page-gutter) mobile:pt-5 mobile:pb-7 mobile:transition-[opacity,translate,visibility] mobile:duration-200 ${
          menuOpen
            ? 'mobile:visible mobile:translate-y-0 mobile:opacity-100'
            : 'mobile:invisible mobile:-translate-y-2 mobile:opacity-0'
        }`}
      >
        <ul className="flex gap-9 mobile:flex-col mobile:gap-1">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                className="text-[1.125rem] text-text-soft transition-colors duration-200 hover:text-accent focus-visible:text-accent mobile:block mobile:py-2.5"
                href={link.href}
                onClick={closeMenu}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
