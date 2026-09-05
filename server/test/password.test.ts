import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

// 邮箱+密码注册需要口令存储。不引第三方依赖:Node 内置 scrypt 是标准 KDF,
// 且避免 Heroku 上的原生编译(bcrypt)。存储格式自带算法与参数,便于日后换参。
describe('密码哈希', () => {
  it('哈希后不等于明文,且不包含明文', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).not.toContain('correct horse battery');
  });

  it('同一密码两次哈希结果不同(每次随机盐)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toEqual(b);
  });

  it('正确密码校验通过', async () => {
    const stored = await hashPassword('s3cret-passphrase');
    expect(await verifyPassword('s3cret-passphrase', stored)).toBe(true);
  });

  it('错误密码校验失败', async () => {
    const stored = await hashPassword('s3cret-passphrase');
    expect(await verifyPassword('wrong-passphrase', stored)).toBe(false);
  });

  it('大小写敏感', async () => {
    const stored = await hashPassword('CaseSensitive');
    expect(await verifyPassword('casesensitive', stored)).toBe(false);
  });

  it('存储格式标明算法与盐,便于日后换参', async () => {
    const stored = await hashPassword('x-any-password');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored.split('$')).toHaveLength(5); // scrypt$N$r$salt$hash
  });

  // 被篡改/损坏的哈希不该抛异常,而应判为不通过 —— 否则一条脏数据能让登录 500。
  it('格式非法的存储值判为不通过而非抛错', async () => {
    expect(await verifyPassword('any', 'garbage')).toBe(false);
    expect(await verifyPassword('any', '')).toBe(false);
    expect(await verifyPassword('any', 'scrypt$1$2$3')).toBe(false);
    expect(await verifyPassword('any', 'bcrypt$1$2$aa$bb')).toBe(false);
  });

  it('unicode 密码可正常往返', async () => {
    const stored = await hashPassword('密码-with-émoji-🔐');
    expect(await verifyPassword('密码-with-émoji-🔐', stored)).toBe(true);
    expect(await verifyPassword('密码-with-emoji-🔐', stored)).toBe(false);
  });
});
