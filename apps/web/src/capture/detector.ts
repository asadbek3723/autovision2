import type { ObjectDetector } from '@mediapipe/tasks-vision';
import { smoothBox, type Box } from './geometry';
import type { Detection } from './criteria';

/**
 * Mashina detektori — MediaPipe ObjectDetector (EfficientDet-Lite0, COCO).
 * Hamma fayl o'zimizning serverdan (public/mediapipe): CDN'ga bog'liq emas,
 * demo joyida internet beqaror bo'lsa ham ishlaydi.
 */

const BASE = `${import.meta.env.BASE_URL ?? '/'}mediapipe`;
const MODEL_URL = `${BASE}/efficientdet_lite0.tflite`;
const WASM_DIR = `${BASE}/wasm`;

/** Taxminiy hajmlar (Content-Length kelmasa progress uchun) */
const SIZE_HINT = { model: 7_254_339, wasmSimd: 11_756_954, wasmNoSimd: 10_960_242 };

/** wasm-feature-detect: SIMD qo'llab-quvvatlanishi */
function simdSupported(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11,
      ])
    );
  } catch {
    return false;
  }
}

async function fetchWithProgress(
  url: string,
  hint: number,
  onBytes: (delta: number) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Yuklab bo'lmadi: ${url}`);
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onBytes(value.byteLength);
  }
  // Content-Length bo'lmasa progress 100% dan oshib ketmasligi uchun hint ishlatilmaydi
  void hint;
}

/**
 * Fayllarni oldindan yuklab brauzer keshini isitadi (progress bilan).
 * Kirish ekranida chaqiriladi — suratga olish boshlanganda hammasi tayyor.
 */
export async function preloadDetectorAssets(onProgress: (fraction: number) => void): Promise<void> {
  const wasmFile = simdSupported() ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
  const wasmHint = simdSupported() ? SIZE_HINT.wasmSimd : SIZE_HINT.wasmNoSimd;
  const total = wasmHint + SIZE_HINT.model;
  let loaded = 0;
  const bump = (delta: number) => {
    loaded += delta;
    onProgress(Math.min(0.99, loaded / total));
  };

  await fetchWithProgress(`${WASM_DIR}/${wasmFile}.js`, 0, () => undefined);
  await fetchWithProgress(`${WASM_DIR}/${wasmFile}.wasm`, wasmHint, bump);
  await fetchWithProgress(MODEL_URL, SIZE_HINT.model, bump);
  onProgress(1);
}

export interface DetectorHandle {
  detect(video: HTMLVideoElement, timestampMs: number): Detection;
  close(): void;
  delegate: 'GPU' | 'CPU';
}

const VEHICLES = new Set(['car', 'truck']);

export async function createDetector(): Promise<DetectorHandle> {
  const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_DIR);

  const make = (delegate: 'GPU' | 'CPU') =>
    ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: 0.3,
      maxResults: 6,
      categoryAllowlist: ['car', 'truck', 'person'],
    });

  let detector: ObjectDetector;
  let delegate: 'GPU' | 'CPU' = 'GPU';
  try {
    detector = await make('GPU');
  } catch {
    delegate = 'CPU';
    detector = await make('CPU');
  }

  let lastBox: Box | null = null;
  let lastSeen = 0;

  return {
    delegate,
    close: () => detector.close(),
    detect(video, timestampMs) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return { kind: 'none', score: 0, box: null };

      const result = detector.detectForVideo(video, timestampMs);

      let bestCar: { score: number; box: Box; area: number } | null = null;
      let bestPerson = 0;

      for (const d of result.detections) {
        const cat = d.categories[0];
        const bb = d.boundingBox;
        if (!cat || !bb) continue;
        const box: Box = {
          x: bb.originX / vw,
          y: bb.originY / vh,
          w: bb.width / vw,
          h: bb.height / vh,
        };
        if (VEHICLES.has(cat.categoryName)) {
          const area = box.w * box.h;
          if (!bestCar || area > bestCar.area) bestCar = { score: cat.score, box, area };
        } else if (cat.categoryName === 'person') {
          bestPerson = Math.max(bestPerson, cat.score);
        }
      }

      if (bestCar) {
        lastBox = smoothBox(lastBox && timestampMs - lastSeen < 500 ? lastBox : null, bestCar.box, 0.5);
        lastSeen = timestampMs;
        return { kind: 'car', score: bestCar.score, box: lastBox };
      }

      // Qisqa uzilishda (≤300ms) oxirgi box saqlanadi — miltillashning oldini oladi
      if (lastBox && timestampMs - lastSeen < 300) {
        return { kind: 'car', score: 0.5, box: lastBox };
      }
      lastBox = null;
      if (bestPerson >= 0.5) return { kind: 'person', score: bestPerson, box: null };
      return { kind: 'none', score: 0, box: null };
    },
  };
}
