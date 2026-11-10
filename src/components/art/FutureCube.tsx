/** Rotations of the six faces; each face is then pushed out by half the edge (`--cube`). */
const FACES = [
  'rotateY(0deg)',
  'rotateY(90deg)',
  'rotateY(180deg)',
  'rotateY(-90deg)',
  'rotateX(90deg)',
  'rotateX(-90deg)',
];

const OUTER_FACE_CLASSES = [
  'absolute inset-0 rounded-[6px] border border-neon/75',
  'bg-[linear-gradient(rgb(111_227_255/0.16)_1px,transparent_1px),linear-gradient(90deg,rgb(111_227_255/0.16)_1px,transparent_1px)] bg-[length:25%_25%]',
  'shadow-[0_0_28px_rgb(111_227_255/0.35),inset_0_0_36px_rgb(111_227_255/0.25)]',
].join(' ');

const CORE_FACE_CLASSES =
  'absolute inset-0 rounded-[4px] border border-accent/80 bg-accent/12 shadow-[0_0_22px_rgb(242_181_68/0.45),inset_0_0_18px_rgb(242_181_68/0.35)]';

/**
 * Holographic glass cube (pure CSS 3D) with a smaller golden cube spinning the other way inside.
 * The edge length comes from the `--cube` CSS variable set by the parent.
 */
export function FutureCube() {
  return (
    <div className="relative size-(--cube)" aria-hidden="true">
      <div className="absolute top-1/2 left-1/2 size-[190%] -translate-1/2 rounded-full bg-[radial-gradient(circle,rgb(111_227_255/0.28),rgb(242_181_68/0.08)_45%,transparent_70%)] blur-2xl motion-safe:animate-glow" />
      <div className="relative size-full perspective-[1000px] motion-safe:animate-float">
        <div className="relative size-full transform-3d [transform:rotateX(-24deg)_rotateY(35deg)] motion-safe:animate-cube-spin">
          {FACES.map((rotation) => (
            <div
              key={rotation}
              className={OUTER_FACE_CLASSES}
              style={{ transform: `${rotation} translateZ(calc(var(--cube) / 2))` }}
            />
          ))}
          <div className="absolute inset-[32%] transform-3d motion-safe:animate-cube-spin-reverse">
            {FACES.map((rotation) => (
              <div
                key={rotation}
                className={CORE_FACE_CLASSES}
                style={{ transform: `${rotation} translateZ(calc(var(--cube) * 0.18))` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
