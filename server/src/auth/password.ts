import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// scrypt 参数。N 越大越抗暴力破解,代价是每次登录的内存与耗时。
// N=32768,r=8 约需 128*N*r = 32MB,故 maxmem 放到 64MB(Node 默认 32MB 会直接报错)。
const N = 32768;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** 存储格式:scrypt$<N>$<r>$<saltHex>$<hashHex> —— 参数随值走,日后调参不影响旧记录。 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = (await scryptAsync(plain, salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  })) as Buffer;
  return `scrypt$${N}$${R}$${salt.toString('hex')}$${key.toString('hex')}`;
}

/**
 * 校验密码。脏数据(格式非法/参数不是数字/hex 损坏)一律判为不通过 ——
 * 抛异常会让一条坏记录把登录接口打成 500,并泄露"这个账号存在"。
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5) return false;
  const [scheme, nRaw, rRaw, saltHex, hashHex] = parts;
  if (scheme !== 'scrypt') return false;

  const n = Number(nRaw);
  const r = Number(rRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || n <= 1 || r <= 0) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const key = (await scryptAsync(plain, salt, expected.length, {
      N: n,
      r,
      p: P,
      maxmem: MAXMEM,
    })) as Buffer;
    // 定长比较走 timingSafeEqual,避免按字节短路泄露信息
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
