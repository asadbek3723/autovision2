import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

/**
 * Vercel serverless entry — barcha /api/* so'rovlar shu funksiyaga tushadi
 * (Vercel'ning fayl-tizim marshrutlashi: `api/[...slug].ts` = `/api/*`).
 *
 * Fastify instansi lambda o'zagi issiq (warm) turgan davrda qayta ishlatiladi:
 * har so'rovda qaytadan qurilmaydi, faqat birinchi so'rovda tayyorlanadi.
 */
let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
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
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'server_initialization_failed',
        message: err?.message || 'Serverni ishga tushirishda xatolik yuz berdi.',
        hint: 'Vercel Dashboard -> Settings -> Environment Variables bo\'limida SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY sozlamalari kiritilganini tekshiring.'
      })
    );
  }
}
