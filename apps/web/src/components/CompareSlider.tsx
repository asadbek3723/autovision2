import { useRef, useState } from 'react';

/**
 * Reja 25.7: natija chiqqach original va generated versiyani taqqoslash.
 * Sudraluvchi ajratgich — drag va klaviatura bilan boshqariladi.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel = 'Original',
  afterLabel = 'CarVision',
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none overflow-hidden rounded-lg border border-border bg-surface-2 select-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        updateFromClientX(event.clientX);
      }}
    >
      <img src={after} alt={afterLabel} className="block w-full" />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img src={before} alt={beforeLabel} className="block h-full w-full object-cover" />
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-bg/80 backdrop-blur">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10 7-5 5 5 5" />
            <path d="m14 7 5 5-5 5" />
          </svg>
        </span>
      </div>

      <span className="pointer-events-none absolute top-3 left-3 rounded-sm bg-bg/75 px-2 py-1 text-xs text-text-muted backdrop-blur">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-sm bg-bg/75 px-2 py-1 text-xs text-text backdrop-blur">
        {afterLabel}
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Original va natijani taqqoslash"
        className="absolute inset-x-0 bottom-0 h-10 w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
