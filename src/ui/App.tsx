import { ROOM_PREVIEWS } from '../scenes/rooms';
import styles from './App.module.css';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { RoomCarousel } from './components/RoomCarousel';

export function App() {
  return (
    <div className={styles.app}>
      <Navbar />
      <main className={styles.main}>
        <RoomCarousel rooms={ROOM_PREVIEWS} />
      </main>
      <Footer />
    </div>
  );
}
