import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { REQUIRED_ANGLES, REQUIRED_CAR_PHOTOS } from '@carvision/shared';
import { FRAME_RECT } from '../../lib/frameCheck';
import { cn } from '../../lib/format';
import { Spinner } from '../ui/States';
import { useCaptureSession } from '../../capture/useCaptureSession';
import type { DetectorHandle } from '../../capture/detector';
import { isMuted, setMuted, unlockAudio } from '../../capture/fx';
import type { CriterionId } from '../../capture/criteria';
import type { Guidance } from '../../capture/guidance';
import { CarGuide } from './CarGuide';
import { CIcon, type CaptureIconName } from './CaptureIcons';
import { GUIDE_COLORS, type GuideState } from './guideTypes';
import './capture.css';

/** object-contain bilan chizilgan videoning konteyner ichidagi aniq o'rni */
function containBox(cw: number, ch: number, vw: number, vh: number) {
  if (!vw || !vh) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / vw, ch / vh);
  const width = vw * scale;
  const height = vh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

const SHADOW: CSSProperties = { textShadow: '0 1px 8px rgba(0,0,0,0.75)' };

/* ------------------------------------------------------------- ko'rsatma */

const ICON_FOR: Record<Guidance['icon'], CaptureIconName> = {
  rotate: 'rotate',
  sun: 'sun',
  car: 'car',
  person: 'person',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  level: 'level',
  hand: 'hand',
  focus: 'focus',
  check: 'check',
};

function arrowClass(icon: Guidance['icon']): string {
  switch (icon) {
    case 'up':
    case 'down':
      return 'cv-arrow-y';
    case 'left':
    case 'right':
      return 'cv-arrow-x';
    case 'zoom-in':
      return 'cv-arrow-zin';
    case 'zoom-out':
      return 'cv-arrow-zout';
    case 'rotate':
      return 'cv-arrow-spin';
    default:
      return '';
  }
}

function GuidanceBanner({ guidance, label }: { guidance: Guidance; label: string }) {
  const ok = guidance.tone === 'ok';
  return (
    <div
      key={guidance.key}
      className="cv-swap flex min-w-0 items-center gap-2.5 rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur-xs border border-white/10"
      role="status"
      aria-live="polite"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: ok ? GUIDE_COLORS.ok : 'rgba(255,255,255,0.14)' }}
      >
        <span className={cn('flex', arrowClass(guidance.icon))} style={{ transform: guidance.dir === 'back' ? 'scaleX(-1)' : undefined }}>
          <CIcon name={ICON_FOR[guidance.icon]} size={18} strokeWidth={2.2} />
        </span>
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] leading-4 text-white/60" style={SHADOW}>
          Endi: {label}
        </p>
        <p
          className="text-[17px] leading-5 font-semibold tracking-[-0.01em] text-white"
          style={{ ...SHADOW, color: ok ? '#6ff0b4' : '#ffffff' }}
        >
          {guidance.text}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- nuqtalar */

const PIP_LABELS: Record<CriterionId, string> = {
  car: 'Mashina',
  angle: 'Burchak',
  distance: 'Masofa',
  height: 'Balandlik',
  steady: 'Barqaror',
};

function CriteriaPips({
  passes,
  soft,
}: {
  passes: Record<CriterionId, boolean>;
  soft: Record<CriterionId, boolean>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 backdrop-blur-xs border border-white/10" aria-hidden="true">
      {(Object.keys(PIP_LABELS) as CriterionId[]).map((id) => {
        const pass = passes[id];
        const isSoft = soft[id] && pass;
        return (
          <span key={id} className="flex items-center gap-1 text-[11px] leading-3 text-white/75">
            <span
              className="flex h-2 w-2 items-center justify-center rounded-full transition-colors duration-150 shrink-0"
              style={{
                background: isSoft ? 'transparent' : pass ? GUIDE_COLORS.ok : GUIDE_COLORS.bad,
                border: isSoft ? '1px solid rgba(255,255,255,0.45)' : 'none',
              }}
            />
            {PIP_LABELS[id]}
          </span>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- reticle */

function Reticle({ w, h, color, breathing }: { w: number; h: number; color: string; breathing: boolean }) {
  const arm = 28;
  const sw = 3;
  const r = 12;
  const p = sw / 2;
  const d = (x: number, y: number, dx: number, dy: number) =>
    `M ${x + dx * arm} ${y} L ${x + dx * r} ${y} Q ${x} ${y} ${x} ${y + dy * r} L ${x} ${y + dy * arm}`;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn('absolute inset-0', breathing && 'cv-reticle')}
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      style={{ transition: 'stroke 200ms' }}
      aria-hidden="true"
    >
      <path d={d(p, p, 1, 1)} />
      <path d={d(w - p, p, -1, 1)} />
      <path d={d(p, h - p, 1, -1)} />
      <path d={d(w - p, h - p, -1, -1)} />
    </svg>
  );
}

/* -------------------------------------------------------------------- asosiy */

export interface LiveCaptureProps {
  carId: string;
  stream: MediaStream;
  detectorRef: React.RefObject<DetectorHandle | null>;
  detectorReady: boolean;
  sensorGranted: boolean;
  demo: boolean;
  onClose: () => void;
  onFinish: () => void;
}

export function LiveCapture({
  carId,
  stream,
  detectorRef,
  detectorReady,
  sensorGranted,
  demo,
  onClose,
  onFinish,
}: LiveCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [landscape, setLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const [muted, setMutedState] = useState(isMuted);
  const debug = useRef(new URLSearchParams(window.location.search).get('debug') === '1').current;

  const session = useCaptureSession({ carId, videoRef, detectorRef, detectorReady, sensorGranted, demo });
  const { snap, shots, guideRef, flashKey, error, requiredDone, acceptedCount, uploading, compassOff, actions } =
    session;

  /* Video oqimi va o'lcham */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);

    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      setLandscape(window.innerWidth > window.innerHeight);
      setBox(containBox(stage.clientWidth, stage.clientHeight, video.videoWidth, video.videoHeight));
    };
    video.addEventListener('loadedmetadata', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    measure();
    return () => {
      video.removeEventListener('loadedmetadata', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [stream]);

  /* Ekran o'chib qolmasin */
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    return () => {
      void lock?.release().catch(() => undefined);
    };
  }, []);

  /* 8/8 bo'lgach va yuklashlar tugagach — avtomatik davom etish */
  const done = snap.phase === 'done';
  useEffect(() => {
    if (!done || uploading) return;
    const t = window.setTimeout(onFinish, 3500);
    return () => window.clearTimeout(t);
  }, [done, uploading, onFinish]);

  const guide: GuideState = {
    ...guideRef.current,
    phase: snap.phase,
    lockProgress: snap.lockProgress,
    user: snap.bearing,
  };

  const locked = snap.phase === 'locked' || snap.phase === 'captured' || snap.phase === 'done';
  const frameColor = locked ? GUIDE_COLORS.ok : GUIDE_COLORS.bad;
  const rect = {
    left: box.left + box.width * FRAME_RECT.x,
    top: box.top + box.height * FRAME_RECT.y,
    width: box.width * FRAME_RECT.w,
    height: box.height * FRAME_RECT.h,
  };
  const det = snap.box && box.width
    ? {
        left: box.left + box.width * snap.box.x,
        top: box.top + box.height * snap.box.y,
        width: box.width * snap.box.w,
        height: box.height * snap.box.h,
      }
    : null;

  const requiredCount = REQUIRED_ANGLES.filter((a) =>
    shots.some((s) => s.angle === a.id && s.status !== 'failed')
  ).length;
  const stepText = snap.angleIndex < REQUIRED_CAR_PHOTOS ? `${snap.angleIndex + 1}/${REQUIRED_CAR_PHOTOS}` : 'qo‘shimcha';
  const fallbackMode = demo || !detectorReady || snap.sensor !== 'active';
  const safeL = 'max(16px, env(safe-area-inset-left))';
  const safeR = 'max(16px, env(safe-area-inset-right))';
  const safeT = 'max(12px, env(safe-area-inset-top))';
  const safeB = 'max(12px, env(safe-area-inset-bottom))';

  return (
    <div ref={stageRef} className="fixed inset-0 z-50 overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-contain" />

      {/* Ramka atrofini qoraytirish */}
      <div
        className="pointer-events-none absolute rounded-xl"
        style={{ ...rect, boxShadow: '0 0 0 9999px rgba(0,0,0,0.32)' }}
      />

      {/* Aniqlangan mashina qutisi — ilova mashinani "ko'rayotgani" */}
      <div
        className="pointer-events-none absolute rounded-lg"
        style={{
          left: det?.left ?? 0,
          top: det?.top ?? 0,
          width: det?.width ?? 0,
          height: det?.height ?? 0,
          border: '2px solid rgba(255,255,255,0.55)',
          opacity: det ? 1 : 0,
          transition: 'left 120ms linear, top 120ms linear, width 120ms linear, height 120ms linear, opacity 150ms',
        }}
      />

      {/* Reticle */}
      <div className="pointer-events-none absolute" style={rect}>
        {rect.width > 0 && (
          <Reticle
            w={rect.width}
            h={rect.height}
            color={frameColor}
            breathing={snap.phase === 'seeking' && !guide.reducedMotion}
          />
        )}
      </div>

      {/* --------------------------------------------- yuqori chap: Ko'rsatma banner */}
      <div
        className="pointer-events-none absolute z-20 flex flex-col items-start gap-2"
        style={{ left: safeL, top: safeT, maxWidth: 'calc(100vw - 220px)' }}
      >
        <GuidanceBanner guidance={snap.guidance} label={snap.angle.label} />

        {snap.manualOffer && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl bg-black/75 p-2 text-[12px] text-white backdrop-blur-md border border-white/15">
            Kompas noaniq bo‘lishi mumkin.
            <button
              type="button"
              onClick={actions.toggleCompass}
              className="min-h-9 rounded-lg bg-white/15 px-2.5 font-medium active:bg-white/25"
            >
              Kompassiz
            </button>
            <button
              type="button"
              onClick={actions.takeShotManual}
              className="min-h-9 rounded-lg bg-white px-2.5 font-medium text-black active:bg-white/80"
            >
              Qo‘lda olish
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------- yuqori o'ng: tugmalar */}
      <div
        className="absolute z-20 flex items-center gap-2"
        style={{ right: safeR, top: safeT }}
      >
        <button
          type="button"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedState(next);
            unlockAudio();
          }}
          aria-label={muted ? 'Tovushni yoqish' : 'Tovushni o‘chirish'}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/45 text-white backdrop-blur-xs border border-white/10 active:bg-black/75"
        >
          <CIcon name={muted ? 'volume-off' : 'volume'} size={18} />
        </button>
        <button
          type="button"
          onClick={actions.skip}
          className="flex h-9 items-center rounded-lg bg-black/45 px-3 text-[13px] font-medium text-white/90 backdrop-blur-xs border border-white/10 active:bg-black/75"
        >
          O‘tkazish
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/45 text-white backdrop-blur-xs border border-white/10 active:bg-black/75"
        >
          <CIcon name="x" size={18} />
        </button>
      </div>

      {/* Holat nishonlari */}
      <div className="pointer-events-none absolute z-20 flex gap-1.5" style={{ right: safeR, top: `calc(${safeT} + 46px)` }}>
        {demo && <span className="rounded-md bg-warning/85 px-1.5 py-0.5 text-[11px] font-medium text-black">Demo</span>}
        {!demo && !detectorReady && (
          <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] text-white/80">Aniqlash o‘chiq</span>
        )}
        {compassOff && <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] text-white/80">Kompassiz</span>}
      </div>

      {/* ----------------------------------------------- chap past: 3D model (Ixcham) */}
      <div
        className="pointer-events-none absolute z-20 transition-opacity duration-200"
        style={{ left: safeL, bottom: `calc(${safeB} + 56px)`, width: 'clamp(96px, 14vw, 124px)', opacity: 0.8 }}
      >
        <div className="rounded-xl border border-white/15 bg-black/40 p-1 backdrop-blur-xs">
          <CarGuide stateRef={guideRef} guide={guide} style={{ aspectRatio: '3 / 2', width: '100%' }} />
          <p className="mt-1 text-center text-[11px] font-semibold text-white/90 truncate" style={SHADOW}>
            {snap.angle.label} <span className="text-[10px] font-normal text-white/60 tabular-nums">{stepText}</span>
          </p>
        </div>
      </div>

      {/* ----------------------------------------- o'ng taraf o'rta: Rasmga olish dumalog'i */}
      <div
        className="absolute z-30 flex items-center justify-center"
        style={{ right: safeR, top: '50%', transform: 'translateY(-50%)' }}
      >
        <button
          type="button"
          onClick={actions.takeShotManual}
          aria-label="Qo‘lda suratga olish"
          className={cn(
            'group relative flex items-center justify-center rounded-full border-4 transition-all duration-150 active:scale-95 shadow-2xl',
            fallbackMode || snap.manualOffer
              ? 'h-[68px] w-[68px] border-white bg-white/20 backdrop-blur-sm'
              : 'h-[60px] w-[60px] border-white/60 bg-black/30 backdrop-blur-xs'
          )}
        >
          <span
            className="rounded-full transition-all duration-150"
            style={{
              width: fallbackMode || snap.manualOffer ? 48 : 42,
              height: fallbackMode || snap.manualOffer ? 48 : 42,
              backgroundColor: snap.phase === 'locked' ? GUIDE_COLORS.ok : '#ffffff',
            }}
          />
        </button>
      </div>

      {/* ------------------------------------------------- mezon nuqtalari (Markaz pastda ixcham) */}
      <div
        className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
        style={{ bottom: `calc(${safeB} + 52px)` }}
      >
        <CriteriaPips passes={snap.passes} soft={snap.soft} />
      </div>

      {/* --------------------------------------------------------- pastki panel (Miniaturalar & Sanoq) */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-6"
        style={{ paddingLeft: `calc(${safeL} + 130px)`, paddingRight: `calc(${safeR} + 76px)`, paddingBottom: safeB }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 no-scrollbar">
          {shots.map((shot) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => void actions.redo(shot.id)}
              aria-label={`Qayta olish: ${REQUIRED_ANGLES.find((a) => a.id === shot.angle)?.label ?? shot.angle}`}
              className={cn(
                'cv-thumb-in relative h-9 w-13 shrink-0 overflow-hidden rounded-md border',
                shot.status === 'failed' ? 'border-danger' : 'border-white/25'
              )}
            >
              <img src={shot.preview} alt="" className="h-full w-full object-cover" />
              {shot.status === 'uploading' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Spinner size={12} />
                </span>
              )}
              {shot.status === 'failed' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-danger">
                  <CIcon name="alert" size={12} />
                </span>
              )}
              {shot.status === 'done' && (
                <span className="absolute right-0.5 bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-white/85">
                  <CIcon name="redo" size={9} strokeWidth={2.4} />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Ixcham rasm sanog'i va galereya */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 text-center backdrop-blur-xs">
            <span className="text-[12px] font-medium text-white/80 tabular-nums">
              Olindi <strong className="text-white font-semibold">{requiredCount}</strong>/{REQUIRED_CAR_PHOTOS}
            </span>
          </div>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Galereyadan yuklash"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/50 text-white/90 backdrop-blur-xs border border-white/10 active:bg-black/75"
          >
            <CIcon name="gallery" size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) actions.addFromFile(f);
              e.target.value = '';
            }}
          />

          {acceptedCount >= 3 && !requiredDone && (
            <button
              type="button"
              onClick={onFinish}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-accent px-3 text-[13px] font-medium text-white active:bg-accent-strong"
            >
              Yakunlash
              <CIcon name="arrow-right" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Flash */}
      {flashKey > 0 && <div key={flashKey} className="cv-flash pointer-events-none absolute inset-0 bg-white" />}

      {/* Tugadi */}
      {done && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="cv-swap flex flex-col items-center rounded-3xl border border-white/10 bg-black/60 px-12 py-8 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: GUIDE_COLORS.ok }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path className="cv-check-draw" d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <p className="text-[28px] leading-[32px] font-semibold tracking-[-0.03em] text-white">Mashina tayyor</p>
            <p className="mt-1 text-[15px] leading-[22px] text-white/65">8 ta kadr olindi</p>
            <button
              type="button"
              onClick={onFinish}
              disabled={uploading}
              className="mt-6 flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-medium text-white active:bg-accent-strong disabled:opacity-60"
            >
              {uploading ? <Spinner size={16} /> : null}
              {uploading ? 'Yuklanmoqda…' : 'Davom etish'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-4 z-10 rounded-lg bg-danger/90 px-4 py-2 text-center text-sm text-white" style={{ bottom: `calc(${safeB} + 130px)` }}>
          {error}
        </div>
      )}

      {/* Debug (?debug=1): sensor va o'lchovlarni qurilmada sozlash uchun */}
      {debug && (
        <pre className="pointer-events-none absolute left-2 bottom-24 z-30 rounded bg-black/70 p-2 text-[11px] leading-4 text-lime-300">
          {`phase ${snap.phase}  step ${snap.angleIndex}
det ${snap.detectionKind} ${snap.debug.score.toFixed(2)}  fill ${snap.debug.fill.toFixed(2)}  asp ${snap.debug.aspect.toFixed(2)}
bearing ${snap.bearing?.toFixed(0) ?? '—'}  err ${snap.debug.error?.toFixed(0) ?? '—'}  pitch ${snap.debug.pitch?.toFixed(0) ?? '—'}
sensor ${snap.sensor}  det ${detectorReady ? 'on' : 'off'}  demo ${demo}
pass ${(Object.keys(snap.passes) as CriterionId[]).map((k) => `${k[0]}${snap.passes[k] ? '✓' : '✗'}`).join(' ')}`}
        </pre>
      )}

      {/* Portret ogohlantirishi */}
      <div
        className={cn(
          'absolute inset-0 z-40 flex flex-col items-center justify-center px-8 text-center transition-opacity duration-300',
          landscape ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
        style={{
          background: 'radial-gradient(120% 90% at 50% 42%, rgb(11 12 14 / 0.72) 0%, rgb(11 12 14 / 0.92) 100%)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        aria-hidden={landscape}
      >
        <div className="flex flex-col items-center rounded-[28px] border border-white/10 bg-white/[0.04] px-10 py-9">
          <div className="relative mb-7 flex h-[86px] w-[86px] items-center justify-center">
            <span className="cv-breathe absolute inset-0 rounded-full bg-accent/25 blur-xl" />
            <svg viewBox="0 0 88 88" className="cv-turn relative h-full w-full" fill="none" aria-hidden="true">
              <rect x="29" y="12" width="30" height="64" rx="7" stroke="#ffffff" strokeWidth="2.5" />
              <rect x="33" y="19" width="22" height="50" rx="3" fill="var(--color-accent)" opacity="0.28" />
              <path d="M40 15.5h8" stroke="rgb(255 255 255 / 0.6)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mb-2 text-[24px] leading-none font-semibold tracking-[-0.02em] text-white">Telefonni buring</p>
          <p className="text-[15px] leading-snug text-white/55">Mashina kadrga to‘liq sig‘adi</p>
        </div>
      </div>
    </div>
  );
}
