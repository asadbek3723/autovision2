import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';

/**
 * Vercel serverless handler. `scripts/bundle.mjs` bu faylni barcha
 * bog'liqliklar (fastify, supabase-js, @carvision/shared ...) bilan BITTA
 * fayl qilib yig'adi (`api/_app.mjs`); `api/index.js` uni qayta eksport qiladi.
 * Shu tufayli Vercel'da TypeScript kompilyatsiyasi, workspace paketlarini
 * topish va ESM kengaytmalari bilan bog'liq muammolar bo'lmaydi.
 *
 * Fastify instansi lambda "issiq" turgan davrda qayta ishlatiladi.
 */
let appPromise: Promise<FastifyInstance> | null = null;

function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = buildServer()
      .then(async (app) => {
        await app.ready();
        return app;
      })
      .catch((err) => {
        // Xato keshlanmasin — keyingi so'rov qayta urinib ko'rsin
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err) {
    console.error('Server ishga tushmadi:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'server_initialization_failed',
        message: 'Serverni ishga tushirishda xatolik yuz berdi. Vercel > Logs ni tekshiring.',
      })
    );
  }
}
