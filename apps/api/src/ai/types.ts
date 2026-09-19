export interface ReferenceImage {
  image: Buffer;
  mimeType: string;
  /** Promptdagi "IMAGE n" bilan mos keluvchi qisqa izoh */
  label: string;
}

export interface EditImageInput {
  /** Tahrirlanadigan asl rasm (mijozning mashinasi) — promptda "IMAGE 1" */
  image: Buffer;
  mimeType: string;
  prompt: string;
  /** Katalog mahsulotlarining rasmlari — promptda "IMAGE 2..n" */
  references?: ReferenceImage[];
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
