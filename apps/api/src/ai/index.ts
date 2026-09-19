import { env } from '../env.js';
import { mockProvider } from './mock.js';
import { falProvider } from './fal.js';
import { geminiProvider } from './gemini.js';
import { openaiProvider } from './openai.js';
import type { ImageEditProvider } from './types.js';

export { AiError } from './types.js';
export type { ImageEditProvider, EditImageInput, EditImageResult, SourceImage } from './types.js';

const providers: Record<string, ImageEditProvider> = {
  mock: mockProvider,
  fal: falProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
};

export function getProvider(): ImageEditProvider {
  return providers[env.aiProvider] ?? mockProvider;
}
