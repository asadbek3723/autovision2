import { GUIDE_COLORS, type GuideState } from './guideTypes';

/**
 * WebGL/3D ishlamaganda zaxira yo'lboshchi: mashinaga tepadan qarash.
 * Xuddi shu holat (nishon tomon, olinganlar, foydalanuvchi nuqtasi) — faqat 2D.
 */

const CX = 100;
const CY = 67;
const R = 46;

const pos = (bearing: number, r = R) => {
  const rad = (bearing * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
};

function arc(bearing: number, half = 21, r = R) {
  const a = pos(bearing - half, r);
  const b = pos(bearing + half, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function CarGuide2D({ guide }: { guide: GuideState }) {
  const locked = guide.phase === 'locked' || guide.phase === 'captured';
  const zone = locked ? GUIDE_COLORS.ok : GUIDE_COLORS.bad;
  const user = guide.user !== null ? pos(guide.user, R + 14) : null;

  return (
    <svg viewBox="0 0 200 134" className="h-full w-full" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => {
        const b = i * 45;
        const done = guide.captured.some((c) => Math.abs(((c - b + 540) % 360) - 180) < 1);
        const isTarget = Math.abs(((guide.target - b + 540) % 360) - 180) < 1 && guide.phase !== 'done';
        const color = isTarget ? zone : done || guide.phase === 'done' ? GUIDE_COLORS.ok : GUIDE_COLORS.pending;
        return (
          <path
            key={b}
            d={arc(b)}
            stroke={color}
            strokeWidth={isTarget ? 8 : 6}
            strokeLinecap="round"
            fill="none"
            opacity={isTarget ? 1 : done ? 0.95 : 0.55}
            className={isTarget && !locked ? 'cv-seg-blink' : undefined}
          />
        );
      })}

      {/* Mashina (tepadan): old — yuqorida */}
      <g transform={`translate(${CX} ${CY})`}>
        <rect x="-13" y="-27" width="26" height="54" rx="9" fill="#2b3038" stroke="#4a5260" strokeWidth="1.2" />
        <rect x="-9.5" y="-11" width="19" height="20" rx="4" fill="#0c1118" />
        <rect x="-10" y="-26" width="6" height="2.6" rx="1" fill="#dfe9ff" />
        <rect x="4" y="-26" width="6" height="2.6" rx="1" fill="#dfe9ff" />
        <rect x="-10" y="23.4" width="6" height="2.6" rx="1" fill="#6a2a2a" />
        <rect x="4" y="23.4" width="6" height="2.6" rx="1" fill="#6a2a2a" />
      </g>

      {user && (
        <g transform={`translate(${user.x} ${user.y}) rotate(${guide.user! + 180})`}>
          <path d="M 0 -6 L 5 5 L -5 5 Z" fill={locked ? GUIDE_COLORS.ok : '#ffffff'} />
        </g>
      )}
    </svg>
  );
}
