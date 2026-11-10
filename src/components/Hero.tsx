import { sectionHref } from '../navigation';
import { FutureCube } from './art/FutureCube';
import { FuturePerson } from './art/FuturePerson';

/** Start screen: title and a holographic cube surrounded by people from the future. */
export function Hero() {
  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-(--page-gutter) py-14 text-center mobile:min-h-[calc(100svh-var(--navbar-height))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_62%,rgb(111_227_255/0.1),transparent_70%)]" />

      <div className="relative motion-safe:animate-rise">
        <h1 className="bg-linear-to-r from-text via-neon to-accent bg-clip-text font-serif text-[length:clamp(2.5rem,6.5vw,5.25rem)] leading-[1.05] font-semibold text-transparent">
          Wirtualna Rzeczywistość
        </h1>
        <p className="pixel-note mt-4 text-[length:clamp(1rem,1.85vw,1.35rem)] text-text-soft">
          Stwórz swoją przestrzeń.
        </p>
        <a
          className="mt-8 inline-block rounded-full border-[1.5px] border-accent px-7 py-3 text-[0.9rem] font-bold tracking-[0.12em] text-accent transition-colors duration-200 hover:bg-accent hover:text-accent-ink focus-visible:bg-accent focus-visible:text-accent-ink"
          href={sectionHref('create')}
        >
          STWÓRZ POKÓJ
        </a>
      </div>

      <div className="relative mt-10 h-[clamp(260px,44svh,460px)] w-full max-w-[1100px] [--cube:clamp(110px,19vmin,200px)] motion-safe:animate-rise motion-safe:[animation-delay:0.15s]">
        {/* Perspective floor grid fading into the distance. */}
        <div className="absolute inset-x-[-15%] bottom-0 h-[55%] origin-bottom [transform:perspective(520px)_rotateX(62deg)] bg-[linear-gradient(rgb(111_227_255/0.22)_1px,transparent_1px),linear-gradient(90deg,rgb(111_227_255/0.22)_1px,transparent_1px)] bg-[length:46px_46px] [mask-image:linear-gradient(to_top,black_20%,transparent)]" />
        <div className="absolute bottom-[9%] left-1/2 aspect-4/1 w-[calc(var(--cube)*1.7)] -translate-x-1/2 rounded-[50%] border border-neon/50 bg-neon/8 shadow-[0_0_36px_rgb(111_227_255/0.35)]" />

        <div className="absolute bottom-[calc(9%+var(--cube)*0.55)] left-1/2 -translate-x-1/2">
          <FutureCube />
        </div>

        <FuturePerson
          pose="reach"
          glow="neon"
          className="absolute bottom-[1%] left-[3%] h-[86%] mobile:left-[-4%] mobile:h-[62%]"
        />
        <FuturePerson
          pose="stand"
          glow="accent"
          className="absolute bottom-[12%] left-[20%] h-[58%] opacity-75 mobile:hidden"
        />
        <FuturePerson
          pose="stand"
          glow="neon"
          className="absolute right-[20%] bottom-[12%] h-[62%] -scale-x-100 opacity-75 mobile:hidden"
        />
        <FuturePerson
          pose="reach"
          glow="accent"
          className="absolute right-[3%] bottom-[1%] h-[82%] -scale-x-100 mobile:right-[-4%] mobile:h-[60%]"
        />
      </div>
    </section>
  );
}
