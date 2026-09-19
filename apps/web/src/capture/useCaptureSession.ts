import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { CAPTURE_ANGLES, REQUIRED_ANGLES, type CaptureAngle } from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { resizeImage } from '../lib/imageResize';
import { FRAME_RECT, FrameAnalyzer, captureFrame } from '../lib/frameCheck';
import { INITIAL_GUIDE_STATE, type GuidePhase, type GuideState } from '../components/capture/guideTypes';
import {
  ANGLE_SPECS,
  Hysteresis,
  TOL,
  evaluate,
  type CriterionId,
  type Detection,
  type Evaluation,
  type Measurements,
} from './criteria';
import type { DetectorHandle } from './detector';
import { playError, playLock, playShutter } from './fx';
import type { Box } from './geometry';
import { GuidanceHold, resolveGuidance, type Guidance } from './guidance';
import { OrientationTracker } from './orientation';
import { BearingEstimator, azimuthToCar } from './orientationMath';

/**
 * Suratga olish sessiyasi: kamera tahlili → mezonlar → holat mashinasi →
 * avto-suratga olish → yuklash. Barcha "issiq" qiymatlar ref'larda (120ms
 * tick ichida qayta chizilishsiz), React'ga faqat ko'rinadigan snapshot beriladi.
 */

const TICK_MS = 120;
const CAPTURED_MS = 900;
const COMPASS_OFF_KEY = 'carvision_compass_off';

export interface Shot {
  id: string;
  angle: string;
  preview: string;
  status: 'uploading' | 'done' | 'failed';
  photoId?: string;
  source: 'auto' | 'manual' | 'gallery';
}

export interface SessionSnapshot {
  phase: GuidePhase;
  angleIndex: number;
  angle: CaptureAngle;
  guidance: Guidance;
  passes: Record<CriterionId, boolean>;
  soft: Record<CriterionId, boolean>;
  lockProgress: number;
  /** Aniqlangan mashina qutisi (debug uchun) */
  box: Box | null;
  detectionKind: Detection['kind'];
  bearing: number | null;
  sensor: 'active' | 'unavailable' | 'off';
  /** Kompas qotib qolgan bo'lishi mumkin — qo'lda rejim taklif qilinadi */
  manualOffer: boolean;
  debug: { pitch: number | null; fill: number; aspect: number; error: number | null; score: number };
}

export interface CaptureSessionParams {
  carId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  detectorRef: RefObject<DetectorHandle | null>;
  detectorReady: boolean;
  /** Foydalanuvchi sensor ruxsatini berdimi */
  sensorGranted: boolean;
  /** Demo rejim: mashina mezoni o'tkazib yuboriladi */
  demo: boolean;
}

const EMPTY_PASSES: Record<CriterionId, boolean> = {
  car: false,
  angle: false,
  distance: false,
  height: false,
  steady: false,
};

function readCompassOff(): boolean {
  try {
    return localStorage.getItem(COMPASS_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Keyingi rakurs: hali olinmagan birinchi majburiy rakurs (aylanma), joriysidan keyin */
function pickNext(after: number, shots: Shot[], includeCurrent = false): number {
  const done = new Set(shots.filter((s) => s.status !== 'failed').map((s) => s.angle));
  const n = REQUIRED_ANGLES.length;
  for (let step = includeCurrent ? 0 : 1; step <= n; step++) {
    const idx = (after + step) % n;
    const angle = CAPTURE_ANGLES[idx];
    if (angle && !done.has(angle.id)) return idx;
  }
  return -1;
}

export function useCaptureSession({
  carId,
  videoRef,
  detectorRef,
  detectorReady,
  sensorGranted,
  demo,
}: CaptureSessionParams) {
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ ref'lar */
  const guideRef = useRef<GuideState>({ ...INITIAL_GUIDE_STATE, reducedMotion });
  const analyzer = useRef(new FrameAnalyzer());
  const estimator = useRef(new BearingEstimator());
  const tracker = useRef(new OrientationTracker());
  const hysteresis = useRef(new Hysteresis());
  const hold = useRef(new GuidanceHold(600));

  const angleIndexRef = useRef(0);
  const phaseRef = useRef<GuidePhase>('intro');
  const shotsRef = useRef<Shot[]>([]);
  const introUntil = useRef(0);
  const lockStart = useRef(0);
  const capturedUntil = useRef(0);
  const cooldownUntil = useRef(0);
  const stuckSince = useRef<number | null>(null);
  const manualOfferRef = useRef(false);
  const capturing = useRef(false);
  const lastAzCar = useRef<number | null>(null);
  const sensorSeenAt = useRef(0);
  const detectorFailed = useRef(false);

  const demoRef = useRef(demo);
  const detectorReadyRef = useRef(detectorReady);
  demoRef.current = demo;
  detectorReadyRef.current = detectorReady;

  /* ------------------------------------------------------------- holat */
  const [shots, setShots] = useState<Shot[]>([]);
  const [flashKey, setFlashKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [compassOff, setCompassOff] = useState(readCompassOff);
  const compassOffRef = useRef(compassOff);
  compassOffRef.current = compassOff;

  const [snap, setSnap] = useState<SessionSnapshot>(() => ({
    phase: 'intro',
    angleIndex: 0,
    angle: CAPTURE_ANGLES[0]!,
    guidance: { key: 'intro', text: CAPTURE_ANGLES[0]!.hint, icon: 'car', tone: 'bad' },
    passes: EMPTY_PASSES,
    soft: EMPTY_PASSES,
    lockProgress: 0,
    box: null,
    detectionKind: 'none',
    bearing: null,
    sensor: 'off',
    manualOffer: false,
    debug: { pitch: null, fill: 0, aspect: 0, error: null, score: 0 },
  }));

  const updateShots = useCallback((fn: (prev: Shot[]) => Shot[]) => {
    shotsRef.current = fn(shotsRef.current);
    setShots(shotsRef.current);
    // Olingan rakurslarning nominal burchaklari — 3D halqa uchun
    guideRef.current.captured = shotsRef.current
      .filter((s) => s.status !== 'failed')
      .map((s) => REQUIRED_ANGLES.find((a) => a.id === s.angle)?.bearing)
      .filter((b): b is number => b !== undefined);
  }, []);

  const setPhase = useCallback((phase: GuidePhase) => {
    phaseRef.current = phase;
    guideRef.current.phase = phase;
  }, []);

  /** Yangi rakursni boshlash: 3D "avval mashinani ko'rsatib, kerakli tomonga aylanadi" */
  const startStep = useCallback(
    (index: number, first: boolean) => {
      const angle = CAPTURE_ANGLES[index]!;
      angleIndexRef.current = index;
      const g = guideRef.current;
      g.target = angle.bearing;
      g.stepKey += 1;
      g.firstStep = first;
      g.lockProgress = 0;
      setPhase('intro');
      introUntil.current = performance.now() + (first && !reducedMotion ? TOL.introFirstMs : TOL.introMs);
      hysteresis.current.reset();
      hold.current.reset();
      stuckSince.current = null;
      manualOfferRef.current = false;
      capturing.current = false;
    },
    [reducedMotion, setPhase]
  );

  /* -------------------------------------------------------------- yuklash */
  const uploadShot = useCallback(
    async (shot: Shot, blob: Blob) => {
      try {
        const res = await api.uploadCarPhoto(carId, await resizeImage(blob), shot.angle);
        updateShots((prev) =>
          prev.map((s) => (s.id === shot.id ? { ...s, status: 'done', photoId: res.photo.id } : s))
        );
      } catch (err) {
        updateShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, status: 'failed' } : s)));
        playError();
        setError(err instanceof ApiRequestError ? err.message : 'Rasm yuklanmadi');
      }
    },
    [carId, updateShots]
  );

  /** Kadr olingandan keyingi umumiy oqim (avto, qo'lda va galereya uchun bir xil) */
  const commit = useCallback(
    (blob: Blob, source: Shot['source']) => {
      const idx = angleIndexRef.current;
      const angle = CAPTURE_ANGLES[idx]!;

      const shot: Shot = {
        id: uid(),
        angle: angle.id,
        preview: URL.createObjectURL(blob),
        status: 'uploading',
        source,
      };
      updateShots((prev) => [...prev.filter((s) => !(s.angle === angle.id && s.status === 'failed')), shot]);
      void uploadShot(shot, blob);

      // Mahkamlash: shu rakursning nominal burchagi — kompas xatosi to'planmasligi uchun
      if (lastAzCar.current !== null) estimator.current.anchor(lastAzCar.current, angle.bearing);

      setError(null);
      setFlashKey((k) => k + 1);
      playShutter();
      setPhase('captured');
      guideRef.current.lockProgress = 0;
      capturedUntil.current = performance.now() + CAPTURED_MS;
      cooldownUntil.current = performance.now() + TOL.cooldownMs;
    },
    [setPhase, updateShots, uploadShot]
  );

  const captureFromVideo = useCallback(
    async (source: Shot['source']) => {
      const video = videoRef.current;
      if (!video || capturing.current) return;
      capturing.current = true;
      const blob = await captureFrame(video, video.videoWidth, video.videoHeight);
      if (!blob) {
        capturing.current = false;
        return;
      }
      commit(blob, source);
    },
    [commit, videoRef]
  );

  /* ---------------------------------------------------------- asosiy tick */
  useEffect(() => {
    startStep(0, true);
    const an = analyzer.current;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const phase = phaseRef.current;
      const now = performance.now();

      /* Tugagan yoki suratdan keyingi qisqa pauza */
      if (phase === 'done') return;
      if (phase === 'captured') {
        if (now >= capturedUntil.current) {
          const next = pickNext(angleIndexRef.current, shotsRef.current);
          if (next < 0) {
            setPhase('done');
            setSnap((s) => ({ ...s, phase: 'done' }));
          } else {
            startStep(next, false);
          }
        }
        return;
      }

      const idx = angleIndexRef.current;
      const angle = CAPTURE_ANGLES[idx]!;
      const spec = ANGLE_SPECS[idx]!;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const landscape = window.innerWidth > window.innerHeight;

      const analysis = an.analyze(video, vw, vh, landscape);

      /* Detektor */
      const isDemo = demoRef.current;
      let detectorOn = detectorReadyRef.current && !detectorFailed.current && !isDemo;
      let detection: Detection = { kind: 'none', score: 0, box: null };
      if (detectorOn && spec.strict && detectorRef.current) {
        try {
          detection = detectorRef.current.detect(video, now);
        } catch (err) {
          console.warn('Detektor xatosi — zaxira rejimga o‘tildi:', err);
          detectorFailed.current = true;
          detectorOn = false;
        }
      }

      /* Sensor */
      let bearing: number | null = null;
      let pitch: number | null = null;
      if (!compassOffRef.current) {
        const pose = tracker.current.get();
        if (pose) {
          sensorSeenAt.current = now;
          pitch = pose.pitch;
          const cx = detection.box ? detection.box.x + detection.box.w / 2 : 0.5;
          const azCar = azimuthToCar(pose.azimuth, cx);
          lastAzCar.current = azCar;
          // Birinchi suratgacha: hozirgi joy = nishon (kalibrovka); keyin nisbiy hisob
          const noneCaptured = shotsRef.current.every((s) => s.status === 'failed');
          if (noneCaptured || !estimator.current.anchored) estimator.current.anchor(azCar, spec.nominal);
          bearing = estimator.current.bearing(azCar);
        }
      }

      const m: Measurements = {
        landscape,
        brightness: analysis.metrics.brightness,
        sharpness: analysis.metrics.sharpness,
        motion: analysis.metrics.motion,
        detection,
        bearing,
        pitch,
        videoW: vw,
        videoH: vh,
      };
      const ev: Evaluation = evaluate(m, spec, { rect: FRAME_RECT, detectorOn, demo: isDemo });
      const rawGuidance = resolveGuidance({ m, ev, spec, angle, detectorOn, demo: isDemo });

      /* Holat mashinasi */
      let lockProgress = 0;
      if (phase === 'intro') {
        if (now >= introUntil.current) setPhase('seeking');
      } else if (phase === 'seeking' || phase === 'locked') {
        const armed = now >= cooldownUntil.current;
        const stable = hysteresis.current.push(ev.allPass && armed);

        if (phase === 'seeking' && stable) {
          setPhase('locked');
          lockStart.current = now;
          playLock();
        } else if (phase === 'locked') {
          if (!stable) {
            setPhase('seeking');
          } else {
            lockProgress = Math.min(1, (now - lockStart.current) / TOL.lockMs);
            if (lockProgress >= 1) void captureFromVideo('auto');
          }
        }

        // Kompas qotib qolganini aniqlash: burchakdan boshqa hammasi joyida
        if (phase === 'seeking' && ev.allButAngle && !ev.passes.angle && bearing !== null) {
          stuckSince.current ??= now;
          if (now - stuckSince.current > TOL.stuckMs) manualOfferRef.current = true;
        } else {
          stuckSince.current = null;
        }
      }
      guideRef.current.lockProgress = lockProgress;
      guideRef.current.user = bearing;

      const guidance = hold.current.push(
        phaseRef.current === 'intro'
          ? { key: 'intro', text: angle.hint, icon: 'car', tone: 'bad' }
          : rawGuidance,
        now
      );

      const sensor: SessionSnapshot['sensor'] = compassOffRef.current
        ? 'off'
        : now - sensorSeenAt.current < 2000
          ? 'active'
          : 'unavailable';

      setSnap({
        phase: phaseRef.current,
        angleIndex: idx,
        angle,
        guidance,
        passes: ev.passes,
        soft: ev.soft,
        lockProgress,
        box: detection.box,
        detectionKind: detection.kind,
        bearing,
        sensor,
        manualOffer: manualOfferRef.current,
        debug: {
          pitch,
          fill: ev.details.fill,
          aspect: ev.details.aspect,
          error: ev.details.bearingError,
          score: detection.score,
        },
      });
    }, TICK_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sensorni yoqish/o'chirish */
  useEffect(() => {
    const t = tracker.current;
    if (sensorGranted && !compassOff) t.start();
    else t.stop();
    return () => t.stop();
  }, [sensorGranted, compassOff]);

  /* Oldingi preview URL'larini tozalash */
  useEffect(
    () => () => {
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.preview));
    },
    []
  );

  /* ---------------------------------------------------------- amallar */
  const takeShotManual = useCallback(() => {
    const p = phaseRef.current;
    if (p !== 'seeking' && p !== 'locked' && p !== 'intro') return;
    void captureFromVideo('manual');
  }, [captureFromVideo]);

  const addFromFile = useCallback(
    (file: File) => {
      const p = phaseRef.current;
      if (p === 'done') return;
      commit(file, 'gallery');
    },
    [commit]
  );

  const skip = useCallback(() => {
    const next = pickNext(angleIndexRef.current, shotsRef.current);
    if (next >= 0 && next !== angleIndexRef.current) startStep(next, false);
  }, [startStep]);

  const redo = useCallback(
    async (shotId: string) => {
      const shot = shotsRef.current.find((s) => s.id === shotId);
      if (!shot) return;
      if (shot.photoId) {
        try {
          await api.deleteCarPhoto(carId, shot.photoId);
        } catch {
          /* server o'chirmasa ham qayta olishga ruxsat beramiz */
        }
      }
      URL.revokeObjectURL(shot.preview);
      updateShots((prev) => prev.filter((s) => s.id !== shotId));
      const idx = CAPTURE_ANGLES.findIndex((a) => a.id === shot.angle);
      if (idx >= 0) startStep(idx, false);
    },
    [carId, startStep, updateShots]
  );

  const toggleCompass = useCallback(() => {
    setCompassOff((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COMPASS_OFF_KEY, next ? '1' : '0');
      } catch {
        /* noop */
      }
      return next;
    });
    manualOfferRef.current = false;
    stuckSince.current = null;
  }, []);

  const requiredDone = REQUIRED_ANGLES.every((a) =>
    shots.some((s) => s.angle === a.id && s.status !== 'failed')
  );
  const acceptedCount = shots.filter((s) => s.status !== 'failed').length;
  const uploading = shots.some((s) => s.status === 'uploading');

  return {
    snap,
    shots,
    guideRef,
    flashKey,
    error,
    requiredDone,
    acceptedCount,
    uploading,
    compassOff,
    actions: { takeShotManual, addFromFile, skip, redo, toggleCompass },
  };
}
