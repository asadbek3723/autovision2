/** Provayderga beriladigan bitta rasm — har doim ochiq (public) URL bilan */
export interface SourceImage {
  /**
   * Ochiq URL (Supabase Storage). URL bilan ishlash muhim: fal.ai kabi provayderlar
   * rasmni o'zi yuklab oladi, ya'ni biz uni serverga tortib, base64 qilib
   * qayta yubormaymiz — bu Vercel'ning 60 soniyalik limitida katta tejamkorlik.
   */
  url: string;
  /** Promptdagi "IMAGE n" bilan mos keluvchi qisqa izoh */
  label: string;
}

export interface EditImageInput {
  /** Tahrirlanadigan asl rasm (mijozning mashinasi) — promptda "IMAGE 1" */
  image: SourceImage;
  /** Katalog mahsulotlarining rasmlari — promptda "IMAGE 2..n" */
  references: SourceImage[];
  prompt: string;
  /** Natija nisbati, masalan "16:9" — asl kadr qirqilmasligi uchun */
  aspectRatio?: string;
}

export interface EditImageResult {
  image: Buffer;
  mimeType: string;
}

export interface ImageEditProvider {
  readonly name: string;
  editImage(input: EditImageInput): Promise<EditImageResult>;
}

export type AiErrorKind = 'quota' | 'timeout' | 'blocked' | 'config' | 'other';

/** Provayder xatosi — foydalanuvchiga tushunarli xabar berish uchun turi bilan */
export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'AiError';
  }
}
