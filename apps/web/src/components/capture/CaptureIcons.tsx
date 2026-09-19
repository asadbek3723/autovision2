import type { ReactNode, SVGProps } from 'react';

/**
 * Suratga olish ekrani ikonalari — umumiy Icon.tsx bilan to'qnashmaslik uchun
 * alohida fayl. 24×24, stroke, mavjud uslub bilan bir xil.
 */

export type CaptureIconName =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'zoom-in'
  | 'zoom-out'
  | 'rotate'
  | 'sun'
  | 'car'
  | 'person'
  | 'hand'
  | 'focus'
  | 'check'
  | 'level'
  | 'gallery'
  | 'volume'
  | 'volume-off'
  | 'x'
  | 'arrow-right'
  | 'redo'
  | 'alert';

const PATHS: Record<CaptureIconName, ReactNode> = {
  up: <path d="m6 14 6-6 6 6M12 8v11" />,
  down: <path d="m6 10 6 6 6-6M12 16V5" />,
  left: <path d="m14 6-6 6 6 6M8 12h11" />,
  right: <path d="m10 6 6 6-6 6M16 12H5" />,
  'zoom-in': (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2M8.5 11h5" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  car: (
    <>
      <path d="M4.5 15.5v-3l1.7-4.2a1.5 1.5 0 0 1 1.4-.9h8.8a1.5 1.5 0 0 1 1.4.9l1.7 4.2v3" />
      <path d="M3.5 12.5h17M4.5 15.5v2.2M19.5 15.5v2.2" />
      <circle cx="8" cy="15" r="0.6" fill="currentColor" />
      <circle cx="16" cy="15" r="0.6" fill="currentColor" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  hand: <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5a1.5 1.5 0 0 1 3 0v5.5m0-3.5a1.5 1.5 0 0 1 3 0v6.5a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 6 15.5V12a1.5 1.5 0 0 1 2 0" />,
  focus: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  level: (
    <>
      <rect x="4" y="9" width="16" height="6" rx="1.5" />
      <path d="M12 9v2.5M8 9v1.5M16 9v1.5" />
    </>
  ),
  gallery: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20 15-4.5-4.5L8 18" />
    </>
  ),
  volume: (
    <>
      <path d="M5 9.5h3.2L12.5 6v12L8.2 14.5H5z" />
      <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M5 9.5h3.2L12.5 6v12L8.2 14.5H5z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  redo: (
    <>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3.5 19h17z" />
      <path d="M12 10v4M12 16.8v.2" />
    </>
  ),
};

export function CIcon({
  name,
  size = 20,
  strokeWidth = 2,
  ...rest
}: { name: CaptureIconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
