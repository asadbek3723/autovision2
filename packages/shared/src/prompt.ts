import { CUSTOMIZATION_GROUPS, findGroup } from './customization.js';

const BASE_INSTRUCTION =
  'Original vehicle photo. Preserve the same vehicle, perspective, camera angle, lighting and background. ' +
  'Apply only the requested modifications. Keep the result photorealistic and consistent with the original vehicle.';

/**
 * Tanlangan option'lar + ixtiyoriy erkin matndan yakuniy AI promptni yig'adi.
 * Reja 11-bo'limdagi prompt prinsipiga amal qiladi.
 */
export function buildPrompt(options: Record<string, string>, freeText?: string): string {
  const parts: string[] = [];

  for (const group of CUSTOMIZATION_GROUPS) {
    const value = options[group.key];
    if (!value) continue;
    const option = group.options.find((o) => o.value === value);
    if (option) parts.push(option.prompt);
  }

  const lines = [BASE_INSTRUCTION];

  if (parts.length > 0) {
    lines.push('Requested modifications: ' + parts.join('; ') + '.');
  }

  const extra = freeText?.trim();
  if (extra) {
    lines.push('Additional request from the user: ' + extra);
  }

  lines.push(
    'Do not change the vehicle body shape, proportions, badges, license plate position or the surrounding scene.'
  );

  return lines.join(' ');
}

/** UI'da tanlovni qisqa matn sifatida ko'rsatish uchun */
export function describeOptions(options: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    const group = findGroup(key);
    const option = group?.options.find((o) => o.value === value);
    if (group && option) out.push(`${group.label}: ${option.label}`);
  }
  return out;
}
