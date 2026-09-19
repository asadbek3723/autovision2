import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { pathToFileURL } from 'node:url';
import { configProblems, env } from './env.js';
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
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
  const app = Fastify({
    logger: env.isDev && !isVercel
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
      : { level: env.isDev ? 'debug' : 'info' },
    bodyLimit: 15 * 1024 * 1024,
    // Vercel/proxy orqasida haqiqiy klient IP'si X-Forwarded-For'dan olinadi
    trustProxy: true,
  });

  // Auth cookie ishlatilmaydi (Bearer header orqali), shuning uchun credentials
  // kerak emas. Production'da faqat WEB_APP_URL (vergul bilan bir nechta bo'lishi
  // mumkin) dan so'rov qabul qilinadi; devda barcha originlar ochiq.
  await app.register(cors, {
    origin: env.isDev ? true : env.webAppUrls,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
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

  const problems = configProblems();
  const blocking = problems.filter((p) => p.level === 'blocking');
  for (const p of problems) app.log.warn({ code: p.code }, p.message);

  // Muhim sozlama yo'q bo'lsa har so'rovda tushunarsiz 500 emas, aniq 503 qaytariladi
  // (/health va / doim javob beradi — Vercel deploy'ni tekshirish uchun).
  app.addHook('onRequest', async (request, reply) => {
    if (blocking.length === 0) return;
    const path = request.url.split('?')[0];
    if (path === '/health' || path === '/') return;
    return reply.status(503).send({
      error: 'misconfigured',
      message: 'Server sozlanmagan. Vercel > Settings > Environment Variables ni tekshiring.',
      problems: blocking.map((p) => ({ code: p.code, message: p.message })),
    });
  });

  app.get('/', async () => ({ name: 'CarVision API', ok: blocking.length === 0 }));

  app.get('/health', async (_request, reply) => {
    if (blocking.length > 0) reply.status(503);
    return {
      ok: blocking.length === 0,
      ai_provider: env.aiProvider,
      env: env.nodeEnv,
      problems: problems.map((p) => ({ level: p.level, code: p.code, message: p.message })),
    };
  });

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
