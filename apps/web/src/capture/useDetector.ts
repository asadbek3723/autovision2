import { useEffect, useRef, useState, type RefObject } from 'react';
import { createDetector, preloadDetectorAssets, type DetectorHandle } from './detector';

export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Detektor fayllarini oldindan yuklaydi (progress bilan) va modelni
 * yaratadi. Kirish ekranida `enabled=true` bo'lishi bilan boshlanadi —
 * foydalanuvchi "Boshlash"ni bosguncha hammasi tayyor bo'ladi.
 */
export function useDetector(enabled: boolean): {
  status: DetectorStatus;
  progress: number;
  handleRef: RefObject<DetectorHandle | null>;
} {
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [progress, setProgress] = useState(0);
  const handleRef = useRef<DetectorHandle | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus('loading');
    setProgress(0);

    (async () => {
      try {
        await preloadDetectorAssets((p) => {
          if (!cancelled) setProgress(p);
        });
        const detector = await createDetector();
        if (cancelled) {
          detector.close();
          return;
        }
        handleRef.current = detector;
        setStatus('ready');
      } catch (err) {
        console.warn('Mashina detektori yuklanmadi:', err);
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, [enabled]);

  return { status, progress, handleRef };
}
