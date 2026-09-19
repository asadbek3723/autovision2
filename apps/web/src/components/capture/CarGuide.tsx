import { Suspense, lazy, useState, type CSSProperties, type RefObject } from 'react';
import { CarGuide2D } from './CarGuide2D';
import { GUIDE_COLORS, type GuideState } from './guideTypes';
import './capture.css';

const CarGuide3D = lazy(() => import('./CarGuide3D').then((m) => ({ default: m.CarGuide3D })));

function webglSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * 3D yo'lboshchi paneli: shisha fon, holatga qarab chegara (qizil "nafas" /
 * yashil to'lib boruvchi halqa) va ichida 3D (yoki zaxira 2D) mashina.
 */
export function CarGuide({
  stateRef,
  guide,
  style,
}: {
  /** 3D sahna har kadrda shu ref'dan o'qiydi */
  stateRef: RefObject<GuideState>;
  /** React holati: chegara va 2D zaxira uchun (≈8 Hz) */
  guide: GuideState;
  style?: CSSProperties;
}) {
  const [use3D, setUse3D] = useState(() => webglSupported());

  const seeking = guide.phase === 'seeking' || guide.phase === 'intro';
  const locked = guide.phase === 'locked';
  const done = guide.phase === 'captured' || guide.phase === 'done';

  const p = Math.round(Math.min(1, Math.max(0, guide.lockProgress)) * 100);
  let frame: string;
  if (locked) frame = `conic-gradient(from 0deg, ${GUIDE_COLORS.ok} ${p}%, rgba(255,255,255,0.14) ${p}%)`;
  else if (done) frame = GUIDE_COLORS.ok;
  else frame = 'rgba(255, 77, 61, 0.55)';

  return (
    <div
      className={seeking && guide.phase === 'seeking' && !guide.reducedMotion ? 'cv-guide-pulse' : undefined}
      style={{
        padding: 3,
        borderRadius: 24,
        background: frame,
        transition: 'background-color 250ms',
        ...style,
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: 21,
          background: 'radial-gradient(90% 90% at 50% 40%, rgba(24,28,34,0.82), rgba(8,9,11,0.9))',
        }}
      >
        {use3D ? (
          <Suspense fallback={<CarGuide2D guide={guide} />}>
            <CarGuide3D stateRef={stateRef} onFail={() => setUse3D(false)} />
          </Suspense>
        ) : (
          <CarGuide2D guide={guide} />
        )}
      </div>
    </div>
  );
}
