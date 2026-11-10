import { useEffect } from 'react';
import { AiSection } from './components/AiSection';
import { ErrorBoundary, ErrorCard } from './components/ErrorBoundary';
import { Hero } from './components/Hero';
import { RoomCarousel } from './components/RoomCarousel';
import { Rooms3DSection } from './components/Rooms3DSection';
import { RoomView } from './components/RoomView';
import { SettingsSection } from './components/SettingsSection';
import { Sidebar } from './components/Sidebar';
import { useSection } from './hooks/useSection';
import type { SectionId } from './navigation';
import { ROOM_PREVIEWS } from './scenes/rooms';

export function App() {
  // "WEJDŹ" links to `?room=...`; the room view is a separate full-screen page.
  const room = new URLSearchParams(window.location.search).get('room');
  return room ? <RoomView /> : <MainPage />;
}

function MainPage() {
  const section = useSection();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);

  return (
    <div className="grid min-h-svh grid-cols-[var(--sidebar-width)_minmax(0,1fr)] mobile:block">
      <Sidebar active={section} />
      <main className="min-w-0 bg-[radial-gradient(60%_50%_at_85%_0%,rgb(242_181_68/0.08),transparent_70%),radial-gradient(50%_60%_at_0%_100%,rgb(90_120_200/0.08),transparent_70%)]">
        <SectionContent section={section} />
      </main>
    </div>
  );
}

function SectionContent({ section }: { section: SectionId }) {
  switch (section) {
    case 'home':
      return <Hero />;
    case 'rooms-2d':
      return <RoomCarousel rooms={ROOM_PREVIEWS} />;
    case 'rooms-3d':
      return <Rooms3DSection />;
    case 'create':
      return (
        // A crash in the AI tools (WebGL, workers, models) must not blank the whole page.
        <ErrorBoundary
          fallback={(err, reset) => (
            <section className="w-full px-(--page-gutter) py-16">
              <ErrorCard
                title="Sekcja AI przestała działać"
                message={err.message}
                onRetry={reset}
              />
            </section>
          )}
        >
          <AiSection />
        </ErrorBoundary>
      );
    case 'settings':
      return <SettingsSection />;
  }
}
