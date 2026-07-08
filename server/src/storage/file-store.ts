import { createHash } from 'node:crypto';

export interface StoreInput {
  fileBase64: string;
  mimeType: string;
}

/** 原始发票存储抽象:Cloudinary 或 null(未配置时不落盘)。 */
export interface FileStore {
  /** 存文件,返回可访问 URL;未配置存储时返回 null。 */
  save(input: StoreInput): Promise<string | null>;
}

export interface CloudinaryConfig {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}

/** 解析 cloudinary://API_KEY:API_SECRET@CLOUD_NAME */
export function parseCloudinaryUrl(url: string): CloudinaryConfig {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url);
  if (!m)
    throw new Error('CLOUDINARY_URL 格式应为 cloudinary://key:secret@cloud');
  return { apiKey: m[1]!, apiSecret: m[2]!, cloudName: m[3]! };
}

export function createNullStore(): FileStore {
  return { save: async () => null };
}

/**
 * Cloudinary 签名上传(REST,不引 SDK)。发票是图片或 PDF,用 resource_type=auto 自动识别。
 * 免费层需在账户 Security 设置开启 PDF 分发,否则回看 PDF 的 URL 会被拒(存储不受影响)。
 */
export function createCloudinaryStore(config: CloudinaryConfig): FileStore {
  return {
    async save({ fileBase64, mimeType }: StoreInput) {
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = 'aabill';
      // 待签参数按字母序拼接,末尾接 api_secret,取 sha1
      const signature = createHash('sha1')
        .update(`folder=${folder}&timestamp=${timestamp}${config.apiSecret}`)
        .digest('hex');

      const form = new FormData();
      form.set('file', `data:${mimeType};base64,${fileBase64}`);
      form.set('api_key', config.apiKey);
      form.set('timestamp', String(timestamp));
      form.set('folder', folder);
      form.set('signature', signature);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
        { method: 'POST', body: form },
      );
      if (!res.ok) {
        throw new Error(
          `Cloudinary 上传失败 ${res.status}: ${await res.text()}`,
        );
      }
      const data = (await res.json()) as { secure_url?: string };
      if (!data.secure_url) throw new Error('Cloudinary 未返回 secure_url');
      return data.secure_url;
    },
  };
}

/** 按环境选存储:有 CLOUDINARY_URL → cloudinary,否则 null。 */
export function selectFileStore(env: Record<string, string | undefined>): {
  kind: 'cloudinary' | 'null';
  store: FileStore;
} {
  if (env.CLOUDINARY_URL) {
    return {
      kind: 'cloudinary',
      store: createCloudinaryStore(parseCloudinaryUrl(env.CLOUDINARY_URL)),
    };
  }
  return { kind: 'null', store: createNullStore() };
}
