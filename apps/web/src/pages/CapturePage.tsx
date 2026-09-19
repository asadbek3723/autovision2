import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { REQUIRED_CAR_PHOTOS } from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { cn } from '../lib/format';
import { useStudio } from '../store/useStudio';
import { useIsDesktop } from '../lib/useIsDesktop';
import { AngleCompass } from '../components/AngleCompass';
import { LiveCapture } from '../components/capture/LiveCapture';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/States';
import { useDetector } from '../capture/useDetector';
import { requestSensorPermission } from '../capture/orientation';
import { unlockAudio } from '../capture/fx';

type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported';
type InputMethod = 'camera' | 'gallery';

interface GalleryPhotoSlot {
  angle: 'front' | 'rear' | 'front-left' | 'front-right';
  label: string;
  hint: string;
  file: File | null;
  previewUrl: string | null;
}

const DEFAULT_SLOTS: GalleryPhotoSlot[] = [
  { angle: 'front', label: '1. Oldidan (Front)', hint: 'Kapot va kapot qismi', file: null, previewUrl: null },
  { angle: 'rear', label: '2. Orqadan (Rear)', hint: 'Bagaj va orqa bamper', file: null, previewUrl: null },
  { angle: 'front-left', label: '3. Old-chap burchak', hint: '45° chap tomondan rasm', file: null, previewUrl: null },
  { angle: 'front-right', label: '4. Old-o‘ng burchak', hint: '45° o‘ng tomondan rasm', file: null, previewUrl: null },
];

/**
 * Avtomobilni rasmga olish: kirish ekrani (3D Kamera yoki Galereyadan 4 ta rasm yuklash).
 */
export function CapturePage() {
  const { id: routeCarId } = useParams();
  const navigate = useNavigate();
  const { setCar } = useStudio();

  const streamRef = useRef<MediaStream | null>(null);
  const [carId, setCarId] = useState(routeCarId ?? '');
  const [carError, setCarError] = useState<string | null>(null);
  const creatingCar = useRef(false);

  // Noutbukda kamera yo'q — desktopda faqat rasm yuklash (galereya) rejimi ishlaydi
  const isDesktop = useIsDesktop();
  const [inputMethod, setInputMethod] = useState<InputMethod>(isDesktop ? 'gallery' : 'camera');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (isDesktop) setInputMethod('gallery');
  }, [isDesktop]);
  const [gallerySlots, setGallerySlots] = useState<GalleryPhotoSlot[]>(DEFAULT_SLOTS);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const detector = useDetector(true);

  /* ------------------------------------------------------------ kamera */
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      return;
    }

    setCamera('starting');

    unlockAudio();
    const permission = requestSensorPermission();
    const fullscreen = document.documentElement.requestFullscreen?.().catch(() => undefined);

    setSensorGranted((await permission) === 'granted');
    try {
      await fullscreen;
      await (screen.orientation as { lock?: (o: string) => Promise<void> })?.lock?.('landscape');
    } catch {
      /* ixtiyoriy */
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
      /* Studio baribir ochiladi */
    }
    navigate('/', { replace: true });
  }, [carId, navigate, setCar, stopStream]);

  const close = useCallback(async () => {
    await finish();
  }, [finish]);

  /* ------------------------------------------------ galereyadan yuklash */
  const handleSlotFileChange = (index: number, file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setGallerySlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, file, previewUrl: url };
      return next;
    });
  };

  /** Bir nechta faylni (tanlash yoki drag&drop) bo'sh ramkalarga tartib bilan joylaydi */
  const handleBulkFiles = (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;

    setGallerySlots((prev) => {
      const next = [...prev];
      let cursor = 0;
      for (const file of files) {
        while (cursor < next.length && (next[cursor]!.file || next[cursor]!.previewUrl)) cursor += 1;
        if (cursor >= next.length) break;
        next[cursor] = { ...next[cursor]!, file, previewUrl: URL.createObjectURL(file) };
      }
      return next;
    });
  };


  const handleFinishGallery = async () => {
    if (!carId) return;
    setIsUploadingGallery(true);
    setUploadError(null);

    try {
      const validSlots = gallerySlots.filter((s) => s.file || s.previewUrl);
      if (validSlots.length === 0) {
        setUploadError('Iltimos, kamida bitta rasm yuklang');
        setIsUploadingGallery(false);
        return;
      }

      for (const slot of gallerySlots) {
        if (slot.file) {
          await api.uploadCarPhoto(carId, slot.file, slot.angle);
        } else if (slot.previewUrl && slot.previewUrl.startsWith('/images/')) {
          const resp = await fetch(slot.previewUrl);
          const blob = await resp.blob();
          await api.uploadCarPhoto(carId, blob, slot.angle);
        }
      }

      const { car } = await api.car(carId);
      setCar(car);
      navigate('/', { replace: true });
    } catch (err) {
      setIsUploadingGallery(false);
      setUploadError(
        err instanceof ApiRequestError ? err.message : 'Rasmlarni yuklashda xatolik yuz berdi'
      );
    }
  };

  /* ------------------------------------------------------- jonli kamera */
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

  const percent = Math.round(detector.progress * 100);
  const selectedCount = gallerySlots.filter((s) => s.file || s.previewUrl).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg px-5 pt-6 pb-6 overflow-y-auto lg:px-10 lg:pt-8 lg:pb-10">
      {/* Faqat desktop: sahifadan chiqish */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mx-auto mb-2 hidden w-full max-w-5xl items-center gap-2 self-start text-[14px] text-text-muted transition-colors hover:text-text lg:flex"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60">
          <Icon name="chevron-left" size={18} />
        </span>
        Studioga qaytish
      </button>

      {camera === 'idle' && (
        <div className="flex flex-1 flex-col max-w-lg mx-auto w-full lg:max-w-5xl lg:justify-center">
          {/* Sarlavha */}
          <div className="cv-rise mb-4 text-center">
            <h1 className="text-[24px] font-bold tracking-[-0.03em] text-text lg:text-[38px]">
              {isDesktop ? 'Mashina rasmlarini yuklang' : 'Mashinani rasmga olish'}
            </h1>
            <p className="mt-1 text-[14px] text-text-muted lg:mt-2 lg:text-[16px]">
              {isDesktop
                ? 'Avtomobilingizning 4 tagacha rasmini tanlang — kamera faqat telefonda ishlaydi'
                : 'Kamera orqali 3D suratga oling yoki galereyadan 4 ta rasm yuklang'}
            </p>
          </div>

          {/* Rejimni tanlash tugmalari (Tabs) */}
          <div className="cv-rise mb-5 flex rounded-2xl border border-white/10 bg-surface/60 p-1 backdrop-blur-md lg:mx-auto lg:mb-8 lg:w-full lg:max-w-xl">
            <button
              type="button"
              disabled={isDesktop}
              title={isDesktop ? 'Jonli kamera faqat telefonda ishlaydi' : undefined}
              onClick={() => setInputMethod('camera')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all whitespace-nowrap',
                isDesktop && 'cursor-not-allowed opacity-50',
                inputMethod === 'camera'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-subtle hover:text-text'
              )}
            >
              <Icon name="camera" size={16} />
              3D Kamera
            </button>
            <button
              type="button"
              onClick={() => setInputMethod('gallery')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all whitespace-nowrap',
                inputMethod === 'gallery'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-subtle hover:text-text'
              )}
            >
              <Icon name="upload" size={16} />
              Galereyadan
            </button>
          </div>

          {/* KAMERA REJIMI */}
          {inputMethod === 'camera' && (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center gap-5 my-4">
                <AngleCompass delay={150} />

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

              <div className="pb-1 mt-auto">
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
                    className="cv-rise cv-cta cv-sheen relative h-[56px] overflow-hidden border-0 text-[16px] font-semibold text-white active:scale-[0.985]"
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
                  onClick={() => setInputMethod('gallery')}
                  className="cv-rise mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 text-[14px] text-accent-soft hover:underline"
                >
                  Mashina yoningizda yo‘qmi? Galereyadan yuklash &rarr;
                </button>
              </div>
            </div>
          )}

          {/* GALEREYADAN YUKLASH REJIMI */}
          {inputMethod === 'gallery' && (
            <div className="flex flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-medium text-text-subtle">
                  Tanlandi: <strong className="text-accent">{selectedCount} / 4</strong> ta rasm
                </span>
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setGallerySlots(DEFAULT_SLOTS)}
                    className="text-[12px] font-semibold text-text-muted hover:text-danger flex items-center gap-1 transition-colors"
                  >
                    <Icon name="refresh" size={13} />
                    Tozalash
                  </button>
                )}
              </div>

              {/* Desktop: bir nechta rasmni birdan tashlash yoki tanlash */}
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  handleBulkFiles(event.dataTransfer.files);
                }}
                className={cn(
                  'mb-4 hidden cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-5 text-[14px] transition-colors lg:flex',
                  dragOver
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-white/20 bg-surface/40 text-text-muted hover:border-accent/60 hover:text-text'
                )}
              >
                <Icon name="upload" size={20} className="text-accent" />
                <span>
                  Rasmlarni shu yerga tashlang yoki{' '}
                  <span className="text-accent-soft underline">fayllarni tanlang</span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    handleBulkFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>

              {/* 4 ta rasm ramkasi */}
              <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4 lg:gap-4 lg:mb-6">
                {gallerySlots.map((slot, idx) => (
                  <div
                    key={slot.angle}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-2xl border transition-all p-3 text-center overflow-hidden min-h-[140px] lg:min-h-[200px]',
                      slot.previewUrl
                        ? 'border-accent bg-accent/10 shadow-lg'
                        : 'border-dashed border-white/20 bg-surface/40 hover:border-accent/60'
                    )}
                  >
                    {slot.previewUrl ? (
                      <>
                        <img
                          src={slot.previewUrl}
                          alt={slot.label}
                          className="absolute inset-0 h-full w-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="relative z-10 flex flex-col items-center justify-end h-full w-full pt-12 pb-1">
                          <span className="text-[11px] font-bold text-white bg-accent/80 px-2 py-0.5 rounded-full mb-1">
                            {slot.label}
                          </span>
                          <label className="cursor-pointer text-[11px] text-accent-soft underline">
                            Almashtirish
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleSlotFileChange(idx, e.target.files?.[0] ?? null)}
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent">
                          <Icon name="plus" size={20} />
                        </div>
                        <span className="text-[13px] font-semibold text-text">{slot.label}</span>
                        <span className="text-[11px] text-text-subtle mt-0.5">{slot.hint}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSlotFileChange(idx, e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {uploadError && (
                <p className="mb-3 text-center text-sm font-medium text-danger flex items-center justify-center gap-1.5">
                  <Icon name="alert" size={16} />
                  {uploadError}
                </p>
              )}

              {/* SAQLASH TUGMASI */}
              <div className="mt-auto pt-2 pb-1 lg:mx-auto lg:mt-4 lg:w-full lg:max-w-md">
                <Button
                  fullWidth
                  size="lg"
                  disabled={isUploadingGallery || selectedCount === 0 || !carId}
                  className="cv-cta cv-sheen relative h-[56px] overflow-hidden border-0 text-[16px] font-semibold text-white active:scale-[0.985]"
                  style={{ borderRadius: 9999 }}
                  onClick={handleFinishGallery}
                >
                  {isUploadingGallery ? (
                    <>
                      <Spinner size={18} />
                      Rasmlar yuklanmoqda…
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={18} />
                      Studio&apos;ga o‘tish ({selectedCount} ta rasm bilan)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {camera === 'starting' && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <Spinner size={26} />
          <p className="mt-5 text-[16px] text-text-muted">Kamera ochilmoqda…</p>
        </div>
      )}

      {(camera === 'denied' || camera === 'unsupported') && (
        <div className="flex flex-1 flex-col justify-center max-w-lg mx-auto w-full">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
            <Icon name="alert" size={26} />
          </div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">
            {camera === 'denied' ? 'Kameraga ruxsat yo‘q' : 'Kamera ochilmadi'}
          </h1>
          <p className="mt-3 max-w-[19rem] text-[16px] leading-snug text-text-muted">
            {camera === 'denied'
              ? 'Brauzer sozlamalaridan kameraga ruxsat bering yoki galereyadan rasmlarni yuklang.'
              : 'Bu qurilmada kamera oqimi mavjud emas. Galereyadan rasmlarni yuklashingiz mumkin.'}
          </p>

          <div className="mt-auto pt-10">
            <Button
              fullWidth
              size="lg"
              className="cv-cta relative h-[58px] border-0 text-[16px] text-white active:scale-[0.985]"
              onClick={() => {
                setCamera('idle');
                setInputMethod('gallery');
              }}
            >
              <Icon name="upload" size={18} />
              Galereyadan yuklash
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

