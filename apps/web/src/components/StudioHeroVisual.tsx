import type { CSSProperties } from 'react';

/**
 * Desktop (lg+) Studio kirish sahifasining o'ng tomoni: ramkasiz, kinematografik
 * mashina rasmi. Rasm ekran chetigacha ochiladi va chap/pastki/yuqori tomondan
 * qorong'i fonga singib ketadi — kartochka, chip yoki bezak yo'q.
 *
 * Bu blok StudioPage'ning to'liq kenglikdagi (relative) konteyneri ichida joylashadi.
 */

const CAR = '/images/b49d788e-38c8-45ef-9ad1-5475a421647f-960x540.jpg';

/** Ikki yo'nalishli yumshoq so'nish: chapga va pastga/tepaga */
const FADE: CSSProperties = {
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to bottom, transparent 0%, #000 22%, #000 74%, transparent 100%)',
  WebkitMaskComposite: 'source-in',
  maskImage:
    'linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to bottom, transparent 0%, #000 22%, #000 74%, transparent 100%)',
  maskComposite: 'intersect',
};

export function StudioHeroVisual() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] lg:block" aria-hidden="true">
      {/* poydevor nuri: mashina ostidagi salqin ko'k yorug'lik */}
      <div
        className="absolute inset-x-[8%] bottom-[10%] h-[34%] blur-3xl"
        style={{ background: 'radial-gradient(60% 100% at 55% 100%, rgb(47 107 255 / 0.35), transparent 70%)' }}
      />

      <div
        className="cv-rise absolute top-1/2 right-0 aspect-[16/9] w-[min(100%,960px)] -translate-y-1/2"
        style={{ animationDelay: '150ms' }}
      >
        <img
          src={CAR}
          alt=""
          draggable={false}
          className="h-full w-full object-cover [filter:saturate(0.92)_contrast(1.04)]"
          style={FADE}
        />
        {/* mashina atrofini chuqurlashtirish */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(80% 85% at 60% 50%, transparent 45%, rgb(11 12 14 / 0.7) 100%)' }}
        />
      </div>

      {/* pastdagi sokin yozuv */}
      <div className="absolute right-10 bottom-8 flex items-center gap-3 text-[12px] tracking-[0.18em] text-text-subtle uppercase">
        <span className="h-px w-10 bg-border-strong" />
        Chevrolet Gentra
      </div>
    </div>
  );
}
