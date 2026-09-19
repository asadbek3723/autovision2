export function haptic(type: 'light' | 'medium' | 'heavy' | 'selection' = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  try {
    switch (type) {
      case 'light':
      case 'selection':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate(35);
        break;
    }
  } catch {}
}

export function notifyHaptic(type: 'success' | 'warning' | 'error'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  try {
    switch (type) {
      case 'success':
        navigator.vibrate([10, 30, 15]);
        break;
      case 'warning':
        navigator.vibrate([20, 40, 20]);
        break;
      case 'error':
        navigator.vibrate([40, 60, 40, 60, 30]);
        break;
    }
  } catch {}
}
