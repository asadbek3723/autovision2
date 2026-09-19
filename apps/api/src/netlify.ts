import type { FastifyInstance } from 'fastify';

/**
 * Netlify Functions handler — butun API (Fastify) bitta funksiya ichida ishlaydi.
 * `scripts/bundle.mjs` bu faylni barcha bog'liqliklar bilan bitta faylga yig'adi:
 * `netlify/functions/api.mjs`. `netlify.toml` `/api/*` va `/health` ni shu funksiyaga yo'naltiradi.
 *
 * Netlify funksiyalarda NODE_ENV berilmaydi; u bo'lmasa env.ts dev rejimini tanlab,
 * pino-pretty'ni yuklashga urinadi (bundle'da yo'q → crash). Shuning uchun server
 * kodi dinamik import qilinadi va undan OLDIN production o'rnatiladi.
 */
process.env.NODE_ENV ??= 'production';

let appPromise: Promise<FastifyInstance> | null = null;

function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = import('./server.js')
      .then(({ buildServer }) => buildServer())
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

/** Rewrite orqali kelganda yo'l shu prefiks bilan boshlanadi: /.netlify/functions/api/api/cars → /api/cars */
const FUNCTION_PREFIX = '/.netlify/functions/api';
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding']);

function stripPrefix(pathname: string): string {
  if (!pathname.startsWith(FUNCTION_PREFIX)) return pathname;
  return pathname.slice(FUNCTION_PREFIX.length) || '/';
}

interface Dispatched {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

async function dispatch(input: {
  method: string;
  pathAndQuery: string;
  headers: Record<string, string>;
  payload?: Buffer;
  ip?: string;
}): Promise<Dispatched> {
  const app = await getApp();
  const res = await app.inject({
    // inject turi usullarni tor ro'yxat sifatida kutadi; haqiqiy qiymat so'rovning o'zidan keladi
    method: input.method as 'GET',
    url: input.pathAndQuery,
    headers: input.headers,
    payload: input.payload,
    // trustProxy yoqilgan: X-Forwarded-For bo'lmasa shu IP ishlatiladi (rate-limit uchun muhim)
    remoteAddress: input.ip,
  });

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(res.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return { status: res.statusCode, headers, body: res.rawPayload };
}

const initError = (err: unknown): Dispatched => {
  console.error('Server ishga tushmadi:', err);
  return {
    status: 500,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(
      JSON.stringify({
        error: 'server_initialization_failed',
        message: 'Serverni ishga tushirishda xatolik yuz berdi. Netlify > Logs > Functions ni tekshiring.',
      })
    ),
  };
};

/* ------------------------------------------- Netlify Functions v2 (Request → Response) */
export default async function netlifyV2(req: Request, context?: { ip?: string }): Promise<Response> {
  let out: Dispatched;
  try {
    const url = new URL(req.url);
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    out = await dispatch({
      method: req.method,
      pathAndQuery: stripPrefix(url.pathname) + url.search,
      headers,
      payload: hasBody ? Buffer.from(await req.arrayBuffer()) : undefined,
      ip: context?.ip,
    });
  } catch (err) {
    out = initError(err);
  }
  const empty = out.status === 204 || out.status === 304;
  return new Response(empty ? null : new Uint8Array(out.body), { status: out.status, headers: out.headers });
}

/* ------------------------------------ Netlify Functions v1 (event → { statusCode, body }) */
/*
 * Zaxira: agar platforma funksiyani v1 deb aniqlasa, shu eksport chaqiriladi.
 * Ikkalasi ham bir xil Fastify ilovasiga tushadi.
 */
interface LegacyEvent {
  httpMethod: string;
  path: string;
  rawUrl?: string;
  rawQuery?: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded: boolean;
}

async function netlifyV1(event: LegacyEvent) {
  let out: Dispatched;
  try {
    const url = event.rawUrl ? new URL(event.rawUrl) : null;
    const pathname = stripPrefix(url?.pathname ?? event.path);
    const search = url?.search ?? (event.rawQuery ? `?${event.rawQuery}` : '');
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.headers ?? {})) {
      if (value !== undefined) headers[key] = value;
    }
    out = await dispatch({
      method: event.httpMethod,
      pathAndQuery: pathname + search,
      headers,
      payload: event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined,
      ip: headers['x-nf-client-connection-ip'],
    });
  } catch (err) {
    out = initError(err);
  }
  return {
    statusCode: out.status,
    headers: out.headers,
    body: out.body.toString('base64'),
    isBase64Encoded: true,
  };
}

// v1 platforma `handler` nomli eksportni chaqiradi
export { netlifyV1 as handler };
