export interface EditImageInput {
  image: Buffer;
  mimeType: string;
  prompt: string;
}

export interface EditImageResult {
  image: Buffer;
  mimeType: string;
}

export interface ImageEditProvider {
  readonly name: string;
  editImage(input: EditImageInput): Promise<EditImageResult>;
}
