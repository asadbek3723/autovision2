import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const KEY_LEN = 64;

export const DUMMY_HASH =
  'scrypt$16384$8$5$dHVtbXlzYWx0MTIzNDU2Nw==$11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111';

function scryptPromise(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptPromise(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  const saltB64 = salt.toString('base64');
  const hashB64 = derivedKey.toString('base64');

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(password: string, hashString: string): Promise<boolean> {
  try {
    const parts = hashString.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!parts[4] || !parts[5]) return false;

    const salt = Buffer.from(parts[4], 'base64');
    const expectedHash = Buffer.from(parts[5], 'base64');

    const derivedKey = await scryptPromise(password, salt, expectedHash.length, {
      N,
      r,
      p,
    });

    return timingSafeEqual(derivedKey, expectedHash);
  } catch {
    return false;
  }
}

export function needsRehash(hashString: string): boolean {
  const parts = hashString.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true;
  return Number(parts[1]) !== SCRYPT_N || Number(parts[2]) !== SCRYPT_R || Number(parts[3]) !== SCRYPT_P;
}
