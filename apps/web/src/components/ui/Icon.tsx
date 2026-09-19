import type { ReactElement } from 'react';

/**
 * Professional icon set — reja 17-bo'limi: product UI'da emoji ishlatilmaydi,
 * ikonalar bir xil stroke va o'lchamda beriladi.
 */
export type IconName =
  | 'upload'
  | 'camera'
  | 'wand'
  | 'grid'
  | 'cart'
  | 'user'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'search'
  | 'sliders'
  | 'alert'
  | 'package'
  | 'refresh'
  | 'arrow-right'
  | 'car'
  | 'shield'
  | 'store'
  | 'x'
  | 'compare'
  | 'rotate'
  | 'brush'
  | 'sparkles'
  | 'eye'
  | 'eye-off'
  | 'lock'
  | 'log-out'
  | 'copy'
  | 'phone'
  | 'clipboard'
  | 'info';

const PATHS: Record<IconName, ReactElement> = {
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  wand: (
    <>
      <path d="M5 19 16 8" />
      <path d="m18 3-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3Z" />
      <path d="m6 5-.6 1.7L3.7 7.3l1.7.6L6 9.6l.6-1.7 1.7-.6-1.7-.6L6 5Z" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  'chevron-left': <path d="m14.5 5-7 7 7 7" />,
  'chevron-right': <path d="m9.5 5 7 7-7 7" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7 7.5 19a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.2v.3" />
    </>
  ),
  package: (
    <>
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
      <path d="M4 8l8 4.5L20 8" />
      <path d="M12 12.5V20.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  car: (
    <>
      <path d="M4.5 16.5V19a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1.5" />
      <path d="M16 17.5V19a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2.5" />
      <path d="M3.5 16.5h17v-4l-1.7-.6-2.1-4a2 2 0 0 0-1.8-1.1H8.1a2 2 0 0 0-1.8 1.1l-2.1 4-1.7.6v4Z" />
      <path d="M7 13.5h.01" />
      <path d="M17 13.5h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4-2.9 7.4-7 8.9-4.1-1.5-7-4.9-7-8.9V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  store: (
    <>
      <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
      <path d="M3.5 10 5 4.5h14L20.5 10a3 3 0 0 1-5.6 1.5A3 3 0 0 1 12 12a3 3 0 0 1-2.9-.5A3 3 0 0 1 3.5 10Z" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  compare: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M12 5v14" />
    </>
  ),
  brush: (
    <>
      <path d="M17.5 3.5a2.6 2.6 0 0 1 3 3L13 14l-3-3z" />
      <path d="M10 11 7.4 13.6a3.5 3.5 0 0 0-.9 3.4c.2.7-.2 1.4-.9 1.7l-2.1.9 1-2.1c.3-.7 0-1.5-.8-1.7" />
      <path d="M6.5 15.5 9 18" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 13 9l5.5 2-5.5 2-2 5.5-2-5.5L3.5 11 9 9z" />
      <path d="M18.5 3v3.5M20.25 4.75h-3.5" />
    </>
  ),
  rotate: (
    <>
      <rect x="8.5" y="2.5" width="7" height="19" rx="2" />
      <path d="M3.5 14.5a9 9 0 0 0 2.6 5" />
      <path d="M2 11.5 3.5 15l3.5-1.5" />
    </>
  ),
  // Yangi ikonlar — auth va UI uchun
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M1 1l22 22" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  'log-out': (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  phone: (
    <>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45c.908.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </>
  ),
  clipboard: (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 17v-5" />
      <path d="M12 7.5v.5" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, className, strokeWidth = 1.6 }: IconProps) {
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
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
