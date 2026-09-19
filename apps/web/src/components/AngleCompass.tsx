import { CAPTURE_ANGLES } from '@carvision/shared';
import { Icon } from './ui/Icon';

/**
 * "8 ta rakurs" tushunchasini bitta diagrammada ko'rsatadi — ro'yxat emas.
 *
 * Kompas: markazda kamera nishoni, atrofida 8 ta nuqta (har biri bitta
 * rakurs), ustida sekin aylanuvchi skaner yoyi. Reja: matn emas, geometriya —
 * "sodda lekin professional" talabiga mos, bo'sh joy qolmaydi.
 */

const SIZE = 224;
const C = SIZE / 2;
const R = 90;

function dotPosition(bearing: number) {
  const rad = (bearing * Math.PI) / 180;
  return { x: C + R * Math.sin(rad), y: C - R * Math.cos(rad) };
}

const DOTS = CAPTURE_ANGLES.filter((a) => a.required).map((a, index) => ({
  id: a.id,
  index,
  ...dotPosition(a.bearing),
}));

export function AngleCompass({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="cv-rise relative mx-auto"
      style={{ width: SIZE, height: SIZE, animationDelay: `${delay}ms` }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="cv-sweep-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Asosiy halqa */}
        <circle cx={C} cy={C} r={R} stroke="var(--color-border)" strokeWidth="1.5" />

        {/* Sekin aylanuvchi skaner yoyi */}
        <g className="cv-orbit" style={{ transformOrigin: `${C}px ${C}px` }}>
          <path
            d={`M ${C} ${C - R} A ${R} ${R} 0 0 1 ${C + R} ${C}`}
            stroke="url(#cv-sweep-2)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx={C + R} cy={C} r="4" fill="var(--color-accent)" />
        </g>

        {/* 8 ta rakurs nuqtasi */}
        {DOTS.map((dot) => (
          <g key={dot.id}>
            <circle
              cx={dot.x}
              cy={dot.y}
              r="10.5"
              fill="var(--color-surface)"
              stroke="var(--color-border-strong)"
              strokeWidth="1.25"
            />
            <circle
              cx={dot.x}
              cy={dot.y}
              r="3.5"
              fill="var(--color-accent-soft)"
              style={{ animation: `cv-node 3.2s ease-in-out ${dot.index * 0.35}s infinite` }}
            />
          </g>
        ))}
      </svg>

      {/* Markaziy nishon — home ekrandagi ikonka plitalari bilan bir xil til */}
      <div
        className="absolute flex items-center justify-center rounded-2xl text-white"
        style={{
          left: C - 30,
          top: C - 30,
          width: 60,
          height: 60,
          background: 'linear-gradient(145deg, #4a80ff, #1d46b8)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.22), 0 10px 24px -10px rgb(47 107 255 / 0.65)',
        }}
      >
        <span className="cv-breathe pointer-events-none absolute -inset-3 rounded-full bg-accent/25 blur-lg" />
        <Icon name="camera" size={24} className="relative" />
      </div>
    </div>
  );
}
