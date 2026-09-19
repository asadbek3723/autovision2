/**
 * Login / ro'yxatdan o'tish hozircha o'chirilgan: ilova ochilishi bilanoq shu qurilma uchun
 * avtomatik mehmon sessiyasi yaratiladi (/api/auth/guest) va foydalanuvchi to'g'ri Studio'ga tushadi.
 *
 * Qayta yoqish uchun: VITE_AUTH_ENABLED=true bilan build qiling — /auth sahifasi va
 * guard'lar avvalgidek ishlaydi.
 */
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';
