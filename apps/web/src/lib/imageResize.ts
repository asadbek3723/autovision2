/**
 * Yuklashdan oldin rasmni brauzerda kichraytirish. Asl kadrlar/mahsulot
 * rasmlari ko'p megabayt bo'lishi mumkin — bu ham yuklash vaqtini, ham
 * keyinchalik sahifada ko'rsatish uchun yuklab olishni sekinlashtiradi
 * (mobil tarmoqda "qotib qolish" hissi shundan kelib chiqadi).
 */
export async function resizeImage(
  blob: Blob,
  maxDimension = 1600,
  quality = 0.86
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return blob;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1) {
    bitmap.close?.();
    return blob;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return blob;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const resized = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );

  return resized ?? blob;
}
