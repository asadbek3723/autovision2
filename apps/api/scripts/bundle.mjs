#!/usr/bin/env node
/**
 * API'ni Vercel uchun bitta ESM faylga yig'adi: api/_app.mjs
 *  - barcha npm bog'liqliklar ichiga kiritiladi (node_modules kerak emas)
 *  - @carvision/shared to'g'ridan-to'g'ri manba (src) dan olinadi — postinstall
 *    build'iga bog'liq emas
 *  - node: modullari tashqarida qoladi
 */
import { build } from 'esbuild';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, '..');
const repoRoot = resolve(apiRoot, '..', '..');
const outfile = join(apiRoot, 'api', '_app.mjs');

await build({
  entryPoints: [join(apiRoot, 'src', 'vercel.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
  alias: {
    '@carvision/shared': join(repoRoot, 'packages', 'shared', 'src', 'index.ts'),
  },
  // Ba'zi CJS bog'liqliklar (fastify, pino ...) require() ishlatadi — ESM ichida shim kerak
  banner: {
    js: "import { createRequire as __cvCreateRequire } from 'node:module';\nconst require = __cvCreateRequire(import.meta.url);",
  },
  // Faqat dev'da ishlatiladigan logger transporti
  external: ['pino-pretty'],
});

const kb = Math.round(statSync(outfile).size / 1024);
console.log(`api/_app.mjs tayyor (${kb} KB)`);
