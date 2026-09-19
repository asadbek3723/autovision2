import { Icon } from './ui/Icon';

/**
 * Desktop (lg+) Studio kirish sahifasining o'ng tomonidagi vizual: demo avtomobil
 * fotosurati, ustida konfiguratorning "shisha" panellari. Faqat ko'rinish — interaktiv emas.
 */

const SWATCHES = ['#f4f5f7', '#1a1c20', '#c2313d', '#2f6bff', '#d8a53a'];

export function StudioHeroVisual() {
  return (
    <div className="relative hidden min-w-0 flex-1 lg:block" aria-hidden="true">
      {/* orqa fon nuri */}
      <div
        className="cv-breathe pointer-events-none absolute -inset-16"
        style={{
          background:
            'radial-gradient(60% 55% at 60% 45%, rgb(47 107 255 / 0.28), transparent 70%)',
        }}
      />

      <div className="cv-rise relative" style={{ animationDelay: '200ms' }}>
       <div className="cv-float relative">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-surface shadow-[0_40px_120px_-30px_rgb(47_107_255/0.55)]">
          <img
            src="/images/b49d788e-38c8-45ef-9ad1-5475a421647f-960x540.jpg"
            alt=""
            className="aspect-[16/10] w-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/85 via-bg/10 to-bg/25" />
          <div className="cv-scan pointer-events-none absolute inset-0" />

          {/* yuqori chap — holat */}
          <div className="absolute top-5 left-5 flex items-center gap-2 rounded-full border border-white/10 bg-bg/60 px-3.5 py-1.5 text-[12px] font-medium text-text backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            AI Studio
          </div>

          {/* pastki — mashina va tanlov */}
          <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
            <div className="rounded-2xl border border-white/10 bg-bg/60 px-4 py-3 backdrop-blur-md">
              <p className="text-[15px] font-semibold text-text">Chevrolet Gentra</p>
              <p className="text-[12px] text-text-muted">Disk · Far · Bamper · Rang</p>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-bg/60 p-2 backdrop-blur-md">
              {SWATCHES.map((color, index) => (
                <span
                  key={color}
                  className={
                    index === 3
                      ? 'h-6 w-6 rounded-full border-2 border-white/90'
                      : 'h-6 w-6 rounded-full border border-white/15'
                  }
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* suzuvchi kartochka */}
        <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-surface/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(145deg, #4a80ff, #1d46b8)' }}
          >
            <Icon name="sparkles" size={18} />
          </span>
          <span>
            <span className="block text-[13px] font-semibold text-text">Natija tayyor</span>
            <span className="block text-[12px] text-text-muted">O‘z mashinangizda ko‘ring</span>
          </span>
        </div>
       </div>
      </div>
    </div>
  );
}
