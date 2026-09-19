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

/** AI'ga qo'shimcha reference rasm sifatida beriladigan katalog mahsuloti */
export interface PromptProduct {
  category: string;
  name: string;
}

const PART_RULES: Record<string, string> = {
  headlights:
    'Replace BOTH front headlight units that are visible on the car with the exact headlight design shown in {ref}. ' +
    'Keep the same shape language, internal projector/LED pattern, light-bar signature and colors of the reference. Do not change the bumper, grille or hood.',
  taillights:
    'Replace BOTH rear taillight units that are visible on the car with the exact taillight design shown in {ref}. ' +
    'Keep the same lens color, LED ring/bar pattern and glow of the reference. Do not change the trunk or bumper.',
  wheels:
    'Replace the rims of ALL visible wheels with the exact alloy wheel design shown in {ref} (same spoke pattern, finish and center cap). ' +
    'Keep the tires, brake parts, wheel arches and car body unchanged; scale and rotate each rim to match that wheel’s size and perspective.',
  grille:
    'Replace the front radiator grille with the exact grille shown in {ref} (same slat pattern, chrome frame and shape). ' +
    'Keep the bumper, headlights and hood unchanged.',
  'front-bumper': 'Replace the front bumper/lip with the part shown in {ref}.',
  'rear-bumper': 'Replace the rear bumper/diffuser with the part shown in {ref}.',
  spoilers: 'Fit the spoiler shown in {ref} on the trunk/roof edge.',
};

/**
 * "Aynan shu rasmni tahrirla" prompti. Rasm tartibi: 1-rasm — mijozning mashinasi,
 * 2..n — tanlangan mahsulotlarning katalog rasmlari (products massivi tartibida).
 */
export function buildEditPrompt(input: {
  /** Statik rang/variantlar (masalan paint) — inglizcha tavsif */
  paint?: string;
  /** Statik qolgan o'zgarishlar */
  extras?: string[];
  products: PromptProduct[];
  freeText?: string;
}): string {
  const lines: string[] = [
    'You are a precise photo retoucher doing a LOCAL EDIT on a real customer photo of their car.',
    'IMAGE 1 is the customer’s real car photo. It is the ONLY image you may edit — return this same photo with just the changes listed below.',
  ];

  input.products.forEach((product, index) => {
    lines.push(
      `IMAGE ${index + 2} is a catalogue reference photo (transparent background) of the product to install: "${product.name}" (${product.category}). Use it only as a design reference, never copy its background.`
    );
  });

  const changes: string[] = [];
  if (input.paint) {
    changes.push(
      `Repaint the car body (doors, fenders, hood, roof, trunk, bumpers) to ${input.paint}. Make the color exact and uniform. ` +
        'The new paint must not tint windows and glass, lights, wheels and tires, badges, chrome and black trim or the mirror glass (parts that other changes below replace are still replaced). Reflections and highlights must follow the new paint realistically.'
    );
  }
  input.products.forEach((product, index) => {
    const rule = PART_RULES[product.category] ?? 'Install the part shown in {ref} on the car in its natural position.';
    changes.push(rule.replace('{ref}', `IMAGE ${index + 2}`));
  });
  for (const extra of input.extras ?? []) changes.push(`Apply: ${extra}.`);
  const note = input.freeText?.trim();
  if (note) changes.push(`Extra request from the customer: ${note}`);

  lines.push('CHANGES TO MAKE:');
  changes.forEach((change, index) => lines.push(`${index + 1}. ${change}`));

  lines.push(
    'STRICT RULES:',
    '- Keep the same car, camera angle, framing, perspective, image size and aspect ratio, background, road, lighting, shadows and every part that is not listed above exactly as in IMAGE 1.',
    '- Do not change the car model, body shape, proportions or license plate; add no text, watermark or logos.',
    '- If a listed part is not visible from this camera angle, leave that part out and do not invent it.',
    '- Make each installed part look physically mounted: match the car’s perspective, scale, lighting and reflections.',
    '- Output one photorealistic image only.'
  );

  return lines.join('\n');
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
