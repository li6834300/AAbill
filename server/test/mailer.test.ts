import { describe, expect, it, vi } from 'vitest';
import {
  createCaptureMailer,
  createConsoleMailer,
  selectMailer,
} from '../src/mail/mailer.js';

// 发信按本仓库既有 provider 模式(selectParser / selectFileStore):
// 没配就回落到不发信的实现,真实现走 HTTP REST 不引 SDK。
describe('发信抽象', () => {
  it('未配置时回落 console,kind 标明', () => {
    const { kind } = selectMailer({});
    expect(kind).toBe('console');
  });

  it('console mailer 把验证链接打到日志(本地开发能自助验证)', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const mailer = createConsoleMailer();
    await mailer.send({
      to: 'a@example.com',
      subject: '验证你的邮箱',
      text: '点这里 https://app.test/verify?token=abc123',
    });
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).toContain('a@example.com');
    expect(logged).toContain('token=abc123');
    spy.mockRestore();
  });

  it('capture mailer 收集发出的信,供测试断言', async () => {
    const mailer = createCaptureMailer();
    await mailer.send({ to: 'b@example.com', subject: 's', text: 'body-1' });
    await mailer.send({ to: 'c@example.com', subject: 's2', text: 'body-2' });
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1]).toMatchObject({ to: 'c@example.com', text: 'body-2' });
  });

  it('配了 RESEND_API_KEY 走 resend', () => {
    const { kind } = selectMailer({
      RESEND_API_KEY: 'rk_test',
      MAIL_FROM: 'no-reply@example.com',
    });
    expect(kind).toBe('resend');
  });

  // 配了 key 却漏了发件人 → 发信必失败。启动时就该看出来,而不是等第一个用户注册
  it('配了 key 但没配 MAIL_FROM 时不静默降级', () => {
    expect(() => selectMailer({ RESEND_API_KEY: 'rk_test' })).toThrow(
      /MAIL_FROM/,
    );
  });
});
