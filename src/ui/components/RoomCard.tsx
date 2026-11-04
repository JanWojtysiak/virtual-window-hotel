import { roomHref, type RoomPreview } from '../../scenes/rooms';
import { formatPrice } from '../../utils/format';
import { RoomArtwork } from './art/RoomArtwork';
import styles from './RoomCard.module.css';

export function RoomCard({ room }: { room: RoomPreview }) {
  return (
    <article className={styles.card}>
      <div className={styles.art}>
        <RoomArtwork scene={room.scene} time={room.time} />
      </div>
      <div className={styles.content}>
        <div>
          <h3 className={styles.title}>{room.name}</h3>
          <p className={styles.price}>
            {formatPrice(room.pricePerNight)} <span>/ noc</span>
          </p>
        </div>
        <a className={styles.enter} href={roomHref(room)} aria-label={`Wejdź: ${room.name}`}>
          WEJDŹ
        </a>
      </div>
    </article>
  );
}
