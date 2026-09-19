import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { REQUIRED_CAR_PHOTOS } from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { useStudio } from '../store/useStudio';
import { AngleCompass } from '../components/AngleCompass';
import { LiveCapture } from '../components/capture/LiveCapture';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/States';
import { useDetector } from '../capture/useDetector';
import { requestSensorPermission } from '../capture/orientation';
import { unlockAudio } from '../capture/fx';

type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported';

/**
 * Avtomobilni rasmga olish: kirish ekrani (ruxsatlar, modelni oldindan
 * yuklash) va jonli aqlli suratga olish (`LiveCapture`).
 */
export function CapturePage() {
  const { id: routeCarId } = useParams();
  const navigate = useNavigate();
  const { setCar } = useStudio();

  const streamRef = useRef<MediaStream | null>(null);

  /*
   * /capture (id'siz) ochilganda avtomobil yozuvi hali yo'q — brend/model
   * keyin aniqlanadi. Shuning uchun bu yerda bo'sh avtomobil yaratiladi va
   * shu id butun sessiya davomida ishlatiladi.
   */
  const [carId, setCarId] = useState(routeCarId ?? '');
  const [carError, setCarError] = useState<string | null>(null);
  const creatingCar = useRef(false);

  const createCarRecord = useCallback(() => {
    if (creatingCar.current) return;
    creatingCar.current = true;
    setCarError(null);

    api
      .createCar({ vehicle_model_id: null, year: null, color: null })
      .then(({ car }) => setCarId(car.id))
      .catch((err) => {
        creatingCar.current = false;
        setCarError(err instanceof ApiRequestError ? err.message : 'Avtomobil yozuvi yaratilmadi');
      });
  }, []);

  useEffect(() => {
    if (!carId) createCarRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [camera, setCamera] = useState<CameraState>('idle');
  const [sensorGranted, setSensorGranted] = useState(false);
  const [demo, setDemo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');

  // Detektor fayllari kirish ekranidayoq yuklana boshlaydi
  const detector = useDetector(true);

  /* ------------------------------------------------------------ kamera */
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      return;
    }

    setCamera('starting');

    // Hammasi foydalanuvchi bosishi ichida boshlanadi: iOS sensor ruxsati va
    // fullscreen shuni talab qiladi. Ruxsat va fullscreen parallel so'raladi.
    unlockAudio();
    const permission = requestSensorPermission();
    const fullscreen = document.documentElement.requestFullscreen?.().catch(() => undefined);

    setSensorGranted((await permission) === 'granted');
    try {
      await fullscreen;
      await (screen.orientation as { lock?: (o: string) => Promise<void> })?.lock?.('landscape');
    } catch {
      /* ixtiyoriy imkoniyatlar (iOS Safari'da yo'q) — davom etamiz */
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCamera('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setCamera(name === 'NotAllowedError' ? 'denied' : 'unsupported');
    }
  }, []);

  const stopStream = useCallback(async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    },
    []
  );

  const finish = useCallback(async () => {
    await stopStream();
    try {
      const { car } = await api.car(carId);
      setCar(car);
    } catch {
      /* Studio baribir ochiladi — avtomobil keyin qayta o'qiladi */
    }
    navigate('/', { replace: true });
  }, [carId, navigate, setCar, stopStream]);

  const close = useCallback(async () => {
    await finish();
  }, [finish]);

  /* ------------------------------------------------------- jonli rejim */
  if (camera === 'live' && streamRef.current && carId) {
    return (
      <LiveCapture
        carId={carId}
        stream={streamRef.current}
        detectorRef={detector.handleRef}
        detectorReady={detector.status === 'ready'}
        sensorGranted={sensorGranted}
        demo={demo}
        onClose={close}
        onFinish={finish}
      />
    );
  }

  /* ------------------------------------------------ kamera ochilmagan holat */
  const percent = Math.round(detector.progress * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg px-6 pt-14 pb-8">
      {camera === 'idle' && (
        <div className="flex flex-1 flex-col">
          <h1 className="cv-rise text-[28px] leading-none font-semibold tracking-[-0.03em]">
            Mashinani suratga oling
          </h1>
          <p
            className="cv-rise mt-3 max-w-[19rem] text-[15px] leading-snug text-text-muted"
            style={{ animationDelay: '70ms' }}
          >
            3D model qayerga borishni ko‘rsatadi. Kadr yashil bo‘lganda {REQUIRED_CAR_PHOTOS} ta rakursni
            kamera o‘zi suratga oladi.
          </p>

          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <AngleCompass delay={150} />

            {/* Aniqlash modeli holati */}
            <div
              className="cv-rise flex min-h-11 items-center gap-2 text-[13px] leading-[18px] text-text-subtle"
              style={{ animationDelay: '260ms' }}
              role="status"
            >
              {detector.status === 'loading' && (
                <>
                  <Spinner size={14} />
                  Mashinani aniqlash tayyorlanmoqda {percent > 0 ? `${percent}%` : ''}
                </>
              )}
              {detector.status === 'ready' && (
                <>
                  <Icon name="check" size={14} className="text-success" />
                  Mashinani aniqlash tayyor
                </>
              )}
              {detector.status === 'failed' && (
                <>
                  <Icon name="alert" size={14} className="text-warning" />
                  Aniqlash yuklanmadi — zaxira rejimda ishlaydi
                </>
              )}
            </div>
          </div>

          <div className="pb-1">
            {carError ? (
              <>
                <p className="mb-3 flex items-start gap-1.5 text-sm text-danger">
                  <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                  {carError}
                </p>
                <Button fullWidth size="lg" onClick={createCarRecord}>
                  <Icon name="refresh" size={16} />
                  Qaytadan urinish
                </Button>
              </>
            ) : (
              <Button
                fullWidth
                size="lg"
                disabled={!carId}
                className="cv-rise cv-cta cv-sheen relative h-[58px] overflow-hidden border-0 text-[16px] text-white active:scale-[0.985]"
                style={{ borderRadius: 9999, animationDelay: '360ms' }}
                onClick={startCamera}
              >
                {carId ? (
                  <>
                    <Icon name="camera" size={18} />
                    Kamerani ochish
                  </>
                ) : (
                  <>
                    <Spinner size={16} />
                    Tayyorlanmoqda…
                  </>
                )}
              </Button>
            )}

            <button
              type="button"
              onClick={() => setDemo((d) => !d)}
              aria-pressed={demo}
              className="cv-rise mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 text-[13px] leading-[18px] text-text-subtle transition-colors active:text-text"
              style={{ animationDelay: '420ms' }}
            >
              {demo ? (
                <>
                  <Icon name="check" size={14} className="text-accent-soft" />
                  Demo rejim yoqilgan — mashinani aniqlamaydi
                </>
              ) : (
                'Mashina yo‘qmi? Demo rejim'
              )}
            </button>
            <p className="cv-rise text-center text-[12px] leading-4 text-text-subtle" style={{ animationDelay: '460ms' }}>
              Brauzer kamera va harakat sensoriga ruxsat so‘raydi
            </p>
          </div>
        </div>
      )}

      {camera === 'starting' && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <Spinner size={26} />
          <p className="mt-5 text-[16px] text-text-muted">Kamera ochilmoqda…</p>
        </div>
      )}

      {(camera === 'denied' || camera === 'unsupported') && (
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
            <Icon name="alert" size={26} />
          </div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
            {camera === 'denied' ? 'Kameraga ruxsat yo‘q' : 'Kamera ochilmadi'}
          </h1>
          <p className="mt-3 max-w-[19rem] text-[16px] leading-snug text-text-muted">
            {camera === 'denied'
              ? 'Brauzer sozlamalaridan kameraga ruxsat bering.'
              : 'Bu qurilmada kamera oqimi mavjud emas (kamera faqat HTTPS orqali ishlaydi).'}
          </p>

          <div className="mt-auto pt-10">
            <Button
              fullWidth
              size="lg"
              className="cv-cta relative h-[58px] border-0 text-[16px] text-white active:scale-[0.985]"
              onClick={startCamera}
            >
              <Icon name="refresh" size={18} />
              Qaytadan urinish
            </Button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-3 min-h-11 w-full text-center text-[14px] text-text-subtle active:text-text"
            >
              Keyinroq
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
