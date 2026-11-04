import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { RoomCarousel } from './components/RoomCarousel';
import { RoomView } from './components/RoomView';
import { ROOM_PREVIEWS } from './scenes/rooms';

export function App() {
  // "WEJDŹ" links to `?room=...`; the room view is a separate full-screen page.
  const room = new URLSearchParams(window.location.search).get('room');
  if (room) {
    return <RoomView />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1 bg-[radial-gradient(60%_50%_at_85%_0%,rgb(242_181_68/0.08),transparent_70%),radial-gradient(50%_60%_at_0%_100%,rgb(90_120_200/0.08),transparent_70%)]">
        <RoomCarousel rooms={ROOM_PREVIEWS} />
      </main>
      <Footer />
    </div>
  );
}
