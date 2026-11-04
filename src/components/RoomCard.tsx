import { roomHref, type RoomPreview } from '../scenes/rooms';
import { formatPrice } from '../utils/format';
import { RoomArtwork } from './art/RoomArtwork';

export function RoomCard({ room }: { room: RoomPreview }) {
  return (
    <article className="group relative isolate aspect-4/5 overflow-hidden rounded-3xl bg-surface shadow-[0_24px_48px_-24px_rgb(0_0_0/0.7)]">
      <div className="absolute inset-0 transition-transform duration-1200 ease-soft group-focus-within:scale-106 group-hover:scale-106 *:size-full">
        <RoomArtwork scene={room.scene} time={room.time} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-linear-to-t from-[rgb(6_9_18/0.92)] via-[rgb(6_9_18/0.55)] via-55% to-transparent px-6 pt-18 pb-6">
        <div>
          <h3 className="mb-1 font-serif text-[1.75rem] leading-[1.1] font-semibold text-white">
            {room.name}
          </h3>
          <p className="text-[1.125rem] font-bold text-accent">
            {formatPrice(room.pricePerNight)}{' '}
            <span className="text-[0.9rem] font-medium text-text-soft">/ noc</span>
          </p>
        </div>
        <a
          className="shrink-0 rounded-full border-[1.5px] border-accent px-[22px] py-3 text-[0.9rem] font-bold tracking-[0.12em] text-accent transition-colors duration-200 hover:bg-accent hover:text-accent-ink focus-visible:bg-accent focus-visible:text-accent-ink"
          href={roomHref(room)}
          aria-label={`Wejdź: ${room.name}`}
        >
          WEJDŹ
        </a>
      </div>
    </article>
  );
}
