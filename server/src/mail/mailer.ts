/**
 * 发信抽象。沿用本仓库既有 provider 模式(selectParser / selectFileStore):
 * 未配置 → 不真发信的回落实现;真实现走 HTTP REST,不引 SDK(与 Cloudinary 一致)。
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * 本地开发用:把信打到服务器日志。
 * 验证链接就在日志里,不配任何服务商也能自助走完验证流程。
 */
export function createConsoleMailer(): Mailer {
  return {
    async send({ to, subject, text }) {
      console.info(`[mail] → ${to} | ${subject}\n${text}`);
    },
  };
}

export interface CaptureMailer extends Mailer {
  sent: Mail[];
}

/** 测试用:把发出的信收集起来供断言。 */
export function createCaptureMailer(): CaptureMailer {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    },
  };
}

/** Resend:单个 POST,无依赖。失败抛错,由调用方决定是否阻断。 */
export function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async send({ to, subject, text }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      if (!res.ok) {
        throw new Error(
          `Resend 发信失败 ${res.status}: ${await res.text().catch(() => '')}`,
        );
      }
    },
  };
}

/**
 * 按环境选 mailer。配了 key 却漏了 MAIL_FROM 直接抛错 ——
 * 那种配置下每封信都会失败,应该在启动时就炸,而不是等第一个用户注册才发现。
 */
export function selectMailer(env: Record<string, string | undefined>): {
  kind: 'console' | 'resend';
  mailer: Mailer;
} {
  if (env.RESEND_API_KEY) {
    const from = env.MAIL_FROM?.trim();
    if (!from) {
      throw new Error('配置了 RESEND_API_KEY 就必须配 MAIL_FROM(发件人地址)');
    }
    return {
      kind: 'resend',
      mailer: createResendMailer(env.RESEND_API_KEY, from),
    };
  }
  return { kind: 'console', mailer: createConsoleMailer() };
}
