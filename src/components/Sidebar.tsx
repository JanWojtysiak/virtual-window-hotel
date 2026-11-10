import { useEffect, useState, type ReactNode } from 'react';
import { sectionHref, type SectionId } from '../navigation';
import { BotIcon } from './BotIcon';

const ROOM_LINKS: readonly { id: SectionId; label: string; hint: string }[] = [
  { id: 'rooms-2d', label: '2D', hint: 'widoki warstwowe' },
  { id: 'rooms-3d', label: '3D', hint: 'sceny przestrzenne' },
];

const LINK_CLASSES =
  'flex items-center gap-3 rounded-xl px-3.5 py-3 text-[1rem] font-semibold text-text-soft transition-colors duration-200 hover:bg-white/4 hover:text-accent focus-visible:text-accent aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent';

export function Sidebar({ active }: { active: SectionId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(true);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const current = (id: SectionId) => (active === id ? 'page' : undefined);

  return (
    <>
      {/* Phones: a slim top bar opens the sidebar as a drawer. */}
      <header className="sticky top-0 z-50 hidden h-(--navbar-height) items-center justify-between gap-4 border-b border-border bg-bg/92 px-(--page-gutter) backdrop-blur-[10px] mobile:flex">
        <Brand onClick={closeMenu} />
        <button
          type="button"
          className="group flex size-11 cursor-pointer flex-col justify-center gap-[5px] rounded-[10px] p-2.5"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="block h-0.5 rounded-xs bg-text transition-[translate,rotate,opacity] duration-250 group-aria-expanded:translate-y-[7px] group-aria-expanded:rotate-45" />
          <span className="block h-0.5 rounded-xs bg-text transition-[translate,rotate,opacity] duration-250 group-aria-expanded:opacity-0" />
          <span className="block h-0.5 rounded-xs bg-text transition-[translate,rotate,opacity] duration-250 group-aria-expanded:-translate-y-[7px] group-aria-expanded:-rotate-45" />
        </button>
      </header>

      <div
        className={`fixed inset-0 z-30 hidden bg-black/55 transition-opacity duration-200 mobile:block ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
        onClick={closeMenu}
      />

      <aside
        id="sidebar"
        className={`sticky top-0 z-40 flex h-svh flex-col overflow-y-auto border-r border-border bg-bg-deep/95 px-4 py-7 mobile:fixed mobile:inset-y-0 mobile:left-0 mobile:w-[min(84vw,var(--sidebar-width))] mobile:pt-[calc(var(--navbar-height)+12px)] mobile:transition-[translate,visibility] mobile:duration-250 ${
          menuOpen
            ? 'mobile:visible mobile:translate-x-0'
            : 'mobile:invisible mobile:-translate-x-full'
        }`}
      >
        <div className="px-3.5 mobile:hidden">
          <Brand />
        </div>

        <nav aria-label="Menu główne" className="mt-12 mobile:mt-0">
          <ul className="grid gap-1.5">
            <li>
              <button
                type="button"
                className={`${LINK_CLASSES} w-full cursor-pointer`}
                aria-expanded={roomsOpen}
                aria-controls="rooms-submenu"
                onClick={() => setRoomsOpen((open) => !open)}
              >
                <NavIcon>
                  <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
                </NavIcon>
                <span className="flex-1 text-left">Gotowe pokoje</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`size-4 transition-transform duration-200 ${roomsOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <ul
                id="rooms-submenu"
                hidden={!roomsOpen}
                className="mt-1 ml-[25px] grid gap-1 border-l border-border pl-3"
              >
                {ROOM_LINKS.map((link) => (
                  <li key={link.id}>
                    <a
                      className={`${LINK_CLASSES} py-2.5`}
                      href={sectionHref(link.id)}
                      aria-current={current(link.id)}
                      onClick={closeMenu}
                    >
                      <span className="w-7 font-bold">{link.label}</span>
                      <span className="pixel-note text-[0.72rem] font-medium text-text-muted">{link.hint}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <a
                className={LINK_CLASSES}
                href={sectionHref('create')}
                aria-current={current('create')}
                onClick={closeMenu}
              >
                <NavIcon>
                  <path d="M12 3v18M3 12h18" />
                </NavIcon>
                Stwórz pokój
              </a>
            </li>
            <li>
              <a
                className={LINK_CLASSES}
                href={sectionHref('settings')}
                aria-current={current('settings')}
                onClick={closeMenu}
              >
                <NavIcon>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
                </NavIcon>
                Ustawienia
              </a>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  );
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <a
      className="group inline-flex items-center gap-3 font-serif text-[1.3rem] leading-[1.15] font-semibold text-text"
      href={sectionHref('home')}
      onClick={onClick}
    >
      <BotIcon className="size-10 shrink-0 text-accent transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-8" />
      <span>Wirtualna Rzeczywistość</span>
    </a>
  );
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
