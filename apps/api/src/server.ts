import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { pathToFileURL } from 'node:url';
import { env } from './env.js';
import { HttpError } from './lib/errors.js';
import { ensureBucket } from './lib/supabase.js';
import { authRoutes } from './routes/auth.js';
import { carRoutes } from './routes/cars.js';
import { generationRoutes } from './routes/generations.js';
import { catalogRoutes } from './routes/catalog.js';
import { cartRoutes } from './routes/cart.js';
import { orderRoutes } from './routes/orders.js';
import { sellerRoutes } from './routes/seller.js';

export async function buildServer() {
  const app = Fastify({
    logger: env.isDev
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
      : true,
    bodyLimit: 15 * 1024 * 1024,
  });

  // Auth cookie ishlatilmaydi (tma/Bearer header orqali), shuning uchun
  // credentials kerak emas. Production'da faqat WEB_APP_URL'dan so'rov qabul
  // qilinadi; devda barcha originlar ochiq (localtunnel/ngrok bilan sinash uchun).
  await app.register(cors, {
    origin: env.isDev ? true : env.webAppUrl,
  });
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      if (error.retryAfter) {
        reply.header('Retry-After', String(error.retryAfter));
      }
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        fields: error.fields,
        retryAfter: error.retryAfter,
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const detail = error instanceof Error ? error.message : 'Nomalum xato';
    if (statusCode >= 500) request.log.error({ err: error }, 'Unhandled error');

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'internal_error' : 'request_error',
      message:
        statusCode >= 500 && !env.isDev
          ? 'Serverda xatolik yuz berdi. Keyinroq urinib koring.'
          : detail,
    });
  });

  app.get('/health', async () => ({
    ok: true,
    ai_provider: env.aiProvider,
    env: env.nodeEnv,
  }));

  await app.register(authRoutes);
  await app.register(carRoutes);
  await app.register(generationRoutes);
  await app.register(catalogRoutes);
  await app.register(cartRoutes);
  await app.register(orderRoutes);
  await app.register(sellerRoutes);

  return app;
}

async function main() {
  const app = await buildServer();

  try {
    await ensureBucket();
  } catch (err) {
    app.log.warn({ err }, 'Storage bucket tayyorlanmadi — rasm yuklash ishlamasligi mumkin');
  }

  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info(`AI provider: ${env.aiProvider}`);
}

// Faqat `node dist/server.js` orqali to'g'ridan-to'g'ri ishga tushirilganda
// serverni tinglashga qo'yamiz. Vercel serverless funksiyasi bu faylni import
// qiladi (listen qilmasdan) — shuning uchun import paytida main() ishlab
// ketmasligi kerak.
//
// `pathToFileURL` ishlatiladi — Windows'da backslash yo'llar va disk harfini
// (`C:\...`) to'g'ri `file:///C:/...` URL'ga aylantiradi. Oddiy satr
// birlashtirish (`file://${argv[1]}`) Windows'da hech qachon mos kelmaydi,
// natijada bu blok hech qachon ishga tushmaydi.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
