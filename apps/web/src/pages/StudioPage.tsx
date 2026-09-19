import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  angleLabel,
  colorLabel,
} from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { generateWithFallback } from '../lib/generate';
import { cn } from '../lib/format';
import { notifyHaptic as notify } from '../lib/haptics';
import { useIsDesktop } from '../lib/useIsDesktop';
import { buildDockGroups, describeSelection } from '../lib/studioGroups';
import { useStudio } from '../store/useStudio';
import { ConfiguratorDock } from '../components/ConfiguratorDock';
import { HomeSteps } from '../components/HomeSteps';
import { StudioHeroVisual } from '../components/StudioHeroVisual';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';

/**
 * Reja 25-bo'limi: AI customization UX — mobile-first konfigurator.
 * Avtomobil hali yo'q bo'lsa, kirish nuqtasi — "Mashinani vizuallashtirish".
 */
export function StudioPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [activeGroup, setActiveGroup] = useState('paint');
  const [noteOpen, setNoteOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { car, photoUrl, options, freeText, setPhotoUrl, toggleOption, setFreeText, setGeneration, reset } =
    useStudio();

  // Katalogdagi mahsulotlar + rang: konfigurator bo'limlari shundan tuziladi
  const catalog = useQuery({
    queryKey: ['catalog-products'],
    queryFn: () => api.products({ limit: 100 }),
    staleTime: 60_000,
  });
  const groups = useMemo(() => buildDockGroups(catalog.data?.products ?? []), [catalog.data]);

  const generate = useMutation({
    mutationFn: () =>
      generateWithFallback({
        carId: car!.id,
        sourceUrl: (photoUrl ?? car!.image_url)!,
        photoUrl: photoUrl ?? undefined,
        options,
        freeText: freeText.trim() || undefined,
      }),
    onSuccess: (generation) => {
      setGeneration(generation);
      notify('success');
      navigate('/result');
    },
    onError: (error) => {
      notify('error');
      setGenerateError(
        error instanceof ApiRequestError
          ? error.message
          : 'AI generatsiya bajarilmadi. Qaytadan urinib ko‘ring.'
      );
    },
  });

  const selectedCount = Object.keys(options).length;
  const stageImage = photoUrl ?? car?.image_url ?? null;
  const canGenerate = Boolean(car && stageImage) && (selectedCount > 0 || freeText.trim().length > 0);

  /* ------------------------------------------------------- kirish holati */
  if (!car || !stageImage) {
    const resuming = Boolean(car && !stageImage);

    return (
      // pb-[var(--nav-h)]: fixed bottom nav tagida CTA qolib ketmasligi uchun joy ajratiladi
      // (desktopda nav yuqorida, shuning uchun pastdan joy kerak emas)
      <div className="relative flex min-h-dvh flex-col overflow-hidden px-5 pt-4 pb-[var(--nav-h)] lg:min-h-[calc(100dvh-var(--nav-h))] lg:justify-center lg:px-0 lg:pt-0 lg:pb-0">
        {/*
          O'ng yuqori burchakdagi yumshoq nur — haqiqiy avtomobil fotosurati
          qo'shilguncha shu joy uni almashtiradi (ArtDirection: HomeSteps.tsx
          bilan bir xil "rounded-[20px]" karta tili allaqachon ekranni to'ldiradi,
          shuning uchun rasm yo'qligi bo'shliq qoldirmaydi).
        */}
        <div
          className="pointer-events-none absolute top-0 right-0 h-[58%] w-[62%] lg:hidden"
          style={{
            background:
              'radial-gradient(70% 55% at 78% 34%, rgb(47 107 255 / 0.22), transparent 70%)',
          }}
        />

        {/* Desktop: ramkasiz, kinematografik mashina rasmi (ekran chetigacha) */}
        <StudioHeroVisual />

        <div className="relative flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1240px] lg:flex-none lg:flex-row lg:items-center lg:gap-20 lg:px-10 lg:py-8">
          <div className="flex flex-1 flex-col lg:w-[540px] lg:flex-none">
            {/* ------------------------------------------------- wordmark */}
            <div className="cv-rise mb-7 lg:hidden" style={{ animationDelay: '40ms' }}>
              <span className="text-[15px] font-medium tracking-[0.24em] text-text">
                CARVISION
              </span>
            </div>

            {/* ------------------------------------------------- sarlavha */}
            <p
              className="cv-rise mb-2 text-[13px] font-semibold tracking-[0.2em] text-accent lg:mb-4"
              style={{ animationDelay: '120ms' }}
            >
              AI STUDIO
            </p>

            <h1
              className="cv-rise t-hero mb-4 max-w-[15ch] lg:mb-5 lg:max-w-[12ch] lg:text-[60px] lg:leading-[1.02]"
              style={{ animationDelay: '180ms' }}
            >
              Avtomobilingizni o‘zgartirishdan oldin{' '}
              <span className="text-accent">ko‘ring</span>
            </h1>

            <p
              className="cv-rise mb-5 max-w-[17rem] text-[15px] leading-relaxed text-text-muted lg:mb-6 lg:max-w-md lg:text-[17px]"
              style={{ animationDelay: '240ms' }}
            >
              Sun’iy intellekt avtomobilingizni realistik ko‘rinishda vizualizatsiya qiladi.
            </p>

            <div className="cv-rise mb-5 flex gap-2 lg:hidden" style={{ animationDelay: '300ms' }}>
              <span className="h-1 w-14 rounded-full bg-accent" />
              <span className="h-1 w-24 rounded-full bg-border-strong" />
            </div>

            {/* ------------------------------------------------- qadamlar */}
            {/* Uch qadam kartochkalari faqat mobilda; desktopda hero o'zi yetarli */}
            <div className="lg:hidden">
              <HomeSteps baseDelay={360} />
            </div>

            {/* ---------------------------------------------------- CTA */}
            <div className="mt-auto pt-5 pb-6 lg:mt-6 lg:pt-0 lg:pb-0">
              <div className="cv-rise" style={{ animationDelay: '640ms' }}>
                <div className="lg:flex lg:items-center lg:gap-3">
                <Button
                  fullWidth
                  size="lg"
                  variant="secondary"
                  className="cv-cta cv-sheen relative h-[62px] overflow-hidden border-0 text-[16px] text-white transition-transform duration-150 active:scale-[0.985]"
                  style={{ borderRadius: 9999 }}
                  onClick={() => navigate(car ? `/capture/${car.id}` : '/capture')}
                >
                  <Icon name={isDesktop ? 'upload' : 'camera'} size={20} />
                  {resuming
                    ? 'Davom ettirish'
                    : isDesktop
                      ? 'Rasm yuklash'
                      : 'Mashinani vizuallashtirish'}
                  <Icon name="arrow-right" size={18} />
                </Button>

                {/* Noutbukda kamera yo'q — jonli suratga olish faqat telefonda */}
                {isDesktop && (
                  <button
                    type="button"
                    disabled
                    title="Jonli kamera faqat telefonda ishlaydi"
                    className="flex h-[62px] shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-border bg-surface/50 px-5 text-[15px] text-text-subtle"
                  >
                    <Icon name="camera" size={18} />
                    Kamera
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                      Faqat telefonda
                    </span>
                  </button>
                )}
                </div>

                {resuming && (
                  <button
                    type="button"
                    onClick={() => navigate('/capture')}
                    className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-text-subtle transition-colors active:text-text lg:hover:text-text"
                  >
                    Boshqa avtomobil
                    <Icon name="chevron-right" size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  /* -------------------------------------------------- konfigurator holati */
  const selections = describeSelection(options, groups);
  const photos = car.photos ?? [];
  const carLabel = [car.detected_brand, car.detected_model, car.year]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col lg:flex-row">
      {/* Sahna ustuni: avtomobil + kadrlar. Desktopda dok o'ng tomonda alohida panel */}
      <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">
      {/* --------------------------------------------------- avtomobil */}
      <div className="relative min-h-0 flex-1 bg-surface lg:bg-[radial-gradient(70%_60%_at_50%_45%,rgb(47_107_255/0.10),transparent_75%)]">
        <img
          src={stageImage}
          alt="Avtomobil"
          className="absolute inset-0 h-full w-full object-contain lg:p-12"
        />

        <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-3 lg:p-6">
          <div className="min-w-0 rounded-lg bg-bg/85 px-3 py-2 backdrop-blur lg:rounded-2xl lg:border lg:border-white/10 lg:px-4 lg:py-2.5">
            <p className="truncate text-sm font-medium lg:text-[15px]">{carLabel || 'Avtomobil'}</p>
            {colorLabel(car.color) && (
              <p className="text-[11px] text-text-muted">{colorLabel(car.color)}</p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("Joriy mashinani va olingan kadrlarni o'chirib, noldan boshlaysizmi?")) {
                  reset();
                  navigate('/capture');
                }
              }}
              title="Qayta boshlash / Bekor qilish"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 text-sm text-danger backdrop-blur transition-colors active:bg-danger/20 lg:rounded-full lg:px-4 lg:hover:bg-danger/20"
            >
              <Icon name="trash" size={16} />
              <span className="hidden sm:inline">Bekor qilish</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/capture/${car.id}`)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-bg/85 px-3 text-sm text-text-muted backdrop-blur active:text-text lg:rounded-full lg:px-4 lg:hover:border-border-strong lg:hover:text-text"
            >
              <Icon name="camera" size={16} />
              Kadrlar
            </button>
          </div>
        </div>

        {selections.length > 0 && (
          <div className="absolute right-3 bottom-3 left-3 rounded-lg bg-bg/85 px-3 py-2 backdrop-blur lg:right-6 lg:bottom-6 lg:left-6 lg:rounded-2xl lg:border lg:border-white/10 lg:px-4 lg:py-3">
            <p className="text-[11px] leading-snug text-text-muted lg:text-[13px]">{selections.join(' · ')}</p>
          </div>
        )}
      </div>

      {/* ------------------------------------ kadrlar (yon tomonga surish) */}
      {photos.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-border bg-surface px-4 py-2 lg:gap-3 lg:px-6 lg:py-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setPhotoUrl(photo.image_url)}
              aria-pressed={photo.image_url === stageImage}
              aria-label={angleLabel(photo.angle)}
              className={cn(
                'h-11 w-16 shrink-0 overflow-hidden rounded-md border transition-colors lg:h-16 lg:w-24 lg:rounded-lg',
                photo.image_url === stageImage ? 'border-accent' : 'border-border'
              )}
            >
              <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>

      {/* --------------------------------------------------------- dok */}
      <ConfiguratorDock
        groups={groups}
        activeKey={activeGroup}
        options={options}
        onSelectGroup={setActiveGroup}
        onSelectOption={(groupKey, value) => {
          if (value === null) {
            const current = options[groupKey];
            if (current) toggleOption(groupKey, current);
          } else {
            toggleOption(groupKey, value);
          }
        }}
      >
        <div className="px-4 pb-3 lg:px-6 lg:py-5">
          {noteOpen ? (
            <Textarea
              value={freeText}
              maxLength={400}
              autoFocus
              placeholder="Masalan: old bamperni pastroq qilib ko‘rsat"
              onChange={(event) => setFreeText(event.target.value)}
              className="mb-3 min-h-16"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="mb-3 flex items-center gap-1.5 text-sm text-text-subtle transition-colors active:text-text"
            >
              <Icon name="plus" size={14} />
              {freeText.trim() ? 'Izohni tahrirlash' : 'Izoh qo‘shish'}
            </button>
          )}

          {generateError && (
            <p className="mb-3 flex items-start gap-1.5 text-sm text-danger">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
              {generateError}
            </p>
          )}

          <Button
            fullWidth
            size="lg"
            loading={generate.isPending}
            disabled={!canGenerate}
            onClick={() => {
              setGenerateError(null);
              generate.mutate();
            }}
          >
            {generate.isPending ? (
              'AI ishlamoqda…'
            ) : (
              <>
                <Icon name="wand" size={18} />
                Natijani ko‘rish
                {selectedCount > 0 && ` (${selectedCount})`}
              </>
            )}
          </Button>
        </div>
      </ConfiguratorDock>
    </div>
  );
}
