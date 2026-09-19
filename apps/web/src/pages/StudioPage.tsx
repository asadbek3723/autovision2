import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  CUSTOMIZATION_GROUPS,
  angleLabel,
  colorLabel,
  describeOptions,
} from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { cn } from '../lib/format';
import { notify } from '../lib/telegram';
import { useStudio } from '../store/useStudio';
import { ConfiguratorDock } from '../components/ConfiguratorDock';
import { HomeSteps } from '../components/HomeSteps';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';

/**
 * Reja 25-bo'limi: AI customization UX — mobile-first konfigurator.
 * Avtomobil hali yo'q bo'lsa, kirish nuqtasi — "Mashinani vizuallashtirish".
 */
export function StudioPage() {
  const navigate = useNavigate();

  const [activeGroup, setActiveGroup] = useState(CUSTOMIZATION_GROUPS[0]!.key);
  const [noteOpen, setNoteOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { car, photoUrl, options, freeText, setPhotoUrl, toggleOption, setFreeText, setGeneration, reset } =
    useStudio();

  const generate = useMutation({
    mutationFn: () =>
      api.generate({
        car_id: car!.id,
        photo_url: photoUrl ?? undefined,
        options,
        free_text: freeText.trim() || undefined,
      }),
    onSuccess: ({ generation }) => {
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
      <div className="relative flex min-h-[calc(100dvh-var(--nav-h))] flex-col overflow-hidden px-5 pt-4">
        {/*
          O'ng yuqori burchakdagi yumshoq nur — haqiqiy avtomobil fotosurati
          qo'shilguncha shu joy uni almashtiradi (ArtDirection: HomeSteps.tsx
          bilan bir xil "rounded-[20px]" karta tili allaqachon ekranni to'ldiradi,
          shuning uchun rasm yo'qligi bo'shliq qoldirmaydi).
        */}
        <div
          className="pointer-events-none absolute top-0 right-0 h-[58%] w-[62%]"
          style={{
            background:
              'radial-gradient(70% 55% at 78% 34%, rgb(47 107 255 / 0.22), transparent 70%)',
          }}
        />

        <div className="relative flex flex-1 flex-col">
          {/* --------------------------------------------------- wordmark */}
          <div className="cv-rise mb-7" style={{ animationDelay: '40ms' }}>
            <span className="text-[15px] font-medium tracking-[0.24em] text-text">
              CARVISION
            </span>
          </div>

          {/* --------------------------------------------------- sarlavha */}
          <p
            className="cv-rise mb-2 text-[13px] font-semibold tracking-[0.2em] text-accent"
            style={{ animationDelay: '120ms' }}
          >
            AI STUDIO
          </p>

          <h1 className="cv-rise t-hero mb-4 max-w-[15ch]" style={{ animationDelay: '180ms' }}>
            Avtomobilingizni o‘zgartirishdan oldin{' '}
            <span className="text-accent">ko‘ring</span>
          </h1>

          <p
            className="cv-rise mb-5 max-w-[17rem] text-[15px] leading-relaxed text-text-muted"
            style={{ animationDelay: '240ms' }}
          >
            Sun’iy intellekt avtomobilingizni realistik ko‘rinishda vizualizatsiya qiladi.
          </p>

          <div className="cv-rise mb-5 flex gap-2" style={{ animationDelay: '300ms' }}>
            <span className="h-1 w-14 rounded-full bg-accent" />
            <span className="h-1 w-24 rounded-full bg-border-strong" />
          </div>

          {/* --------------------------------------------------- qadamlar */}
          <HomeSteps baseDelay={360} />

          {/* -------------------------------------------------------- CTA */}
          <div className="mt-auto pt-5 pb-6">
            <div className="cv-rise" style={{ animationDelay: '640ms' }}>
              <Button
                fullWidth
                size="lg"
                variant="secondary"
                className="cv-cta cv-sheen relative h-[62px] overflow-hidden border-0 text-[16px] text-white transition-transform duration-150 active:scale-[0.985]"
                style={{ borderRadius: 9999 }}
                onClick={() => navigate(car ? `/capture/${car.id}` : '/capture')}
              >
                <Icon name="camera" size={20} />
                {resuming ? 'Davom ettirish' : 'Mashinani vizuallashtirish'}
                <Icon name="arrow-right" size={18} />
              </Button>

              {resuming && (
                <button
                  type="button"
                  onClick={() => navigate('/capture')}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-text-subtle transition-colors active:text-text"
                >
                  Boshqa avtomobil
                  <Icon name="chevron-right" size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------- konfigurator holati */
  const selections = describeOptions(options);
  const photos = car.photos ?? [];
  const carLabel = [car.detected_brand, car.detected_model, car.year]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col">
      {/* --------------------------------------------------- avtomobil */}
      <div className="relative min-h-0 flex-1 bg-surface">
        <img
          src={stageImage}
          alt="Avtomobil"
          className="absolute inset-0 h-full w-full object-contain"
        />

        <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-3">
          <div className="min-w-0 rounded-lg bg-bg/85 px-3 py-2 backdrop-blur">
            <p className="truncate text-sm font-medium">{carLabel || 'Avtomobil'}</p>
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
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 text-sm text-danger backdrop-blur transition-colors active:bg-danger/20"
            >
              <Icon name="trash" size={16} />
              <span className="hidden sm:inline">Bekor qilish</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/capture/${car.id}`)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-bg/85 px-3 text-sm text-text-muted backdrop-blur active:text-text"
            >
              <Icon name="camera" size={16} />
              Kadrlar
            </button>
          </div>
        </div>

        {selections.length > 0 && (
          <div className="absolute right-3 bottom-3 left-3 rounded-lg bg-bg/85 px-3 py-2 backdrop-blur">
            <p className="text-[11px] leading-snug text-text-muted">{selections.join(' · ')}</p>
          </div>
        )}
      </div>

      {/* ------------------------------------ kadrlar (yon tomonga surish) */}
      {photos.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-border bg-surface px-4 py-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setPhotoUrl(photo.image_url)}
              aria-pressed={photo.image_url === stageImage}
              aria-label={angleLabel(photo.angle)}
              className={cn(
                'h-11 w-16 shrink-0 overflow-hidden rounded-md border transition-colors',
                photo.image_url === stageImage ? 'border-accent' : 'border-border'
              )}
            >
              <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------- dok */}
      <ConfiguratorDock
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
        <div className="px-4 pb-3">
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
