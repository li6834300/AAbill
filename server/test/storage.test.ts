import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCloudinaryStore,
  createNullStore,
  parseCloudinaryUrl,
  selectFileStore,
} from '../src/storage/file-store.js';

// PRD §5.4:Owner 上传发票 → Cloudinary 存原图 → 记 invoice_url。
// 存储抽象成 FileStore(cloudinary 签名上传 / null store),无 CLOUDINARY_URL 时不落盘。

describe('parseCloudinaryUrl', () => {
  it('解析 cloudinary://key:secret@cloud', () => {
    expect(
      parseCloudinaryUrl('cloudinary://123456789:abcSECRETxyz@my-cloud'),
    ).toEqual({
      apiKey: '123456789',
      apiSecret: 'abcSECRETxyz',
      cloudName: 'my-cloud',
    });
  });

  it('非法格式抛错', () => {
    expect(() => parseCloudinaryUrl('nope')).toThrow();
    expect(() => parseCloudinaryUrl('cloudinary://onlykey@cloud')).toThrow();
  });
});

describe('createNullStore', () => {
  it('不上传,返回 null(未配置 Cloudinary 时)', async () => {
    const store = createNullStore();
    expect(
      await store.save({ fileBase64: 'aGk=', mimeType: 'image/jpeg' }),
    ).toBeNull();
  });
});

describe('createCloudinaryStore(stub fetch)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const store = () =>
    createCloudinaryStore({
      apiKey: 'KEY',
      apiSecret: 'SECRET',
      cloudName: 'cloud-x',
    });

  it('签名上传到正确端点,form 带 file/api_key/signature,返回 secure_url', async () => {
    const spy = vi.fn(async () =>
      Response.json({ secure_url: 'https://res.cloudinary.com/cloud-x/x.pdf' }),
    );
    vi.stubGlobal('fetch', spy);

    const url = await store().save({
      fileBase64: 'JVBERi0x',
      mimeType: 'application/pdf',
    });
    expect(url).toBe('https://res.cloudinary.com/cloud-x/x.pdf');

    const [endpoint, init] = spy.mock.calls[0] as unknown as [
      string,
      { method: string; body: FormData },
    ];
    expect(endpoint).toBe(
      'https://api.cloudinary.com/v1_1/cloud-x/auto/upload',
    );
    expect(init.method).toBe('POST');
    const form = init.body;
    expect(form.get('file')).toBe('data:application/pdf;base64,JVBERi0x');
    expect(form.get('api_key')).toBe('KEY');
    expect(form.get('folder')).toBe('aabill');

    // 签名 = sha1(排序后的待签参数 + api_secret)
    const timestamp = form.get('timestamp') as string;
    const expected = createHash('sha1')
      .update(`folder=aabill&timestamp=${timestamp}SECRET`)
      .digest('hex');
    expect(form.get('signature')).toBe(expected);
  });

  it('上游非 200 → 抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 401 })),
    );
    await expect(
      store().save({ fileBase64: 'aGk=', mimeType: 'image/jpeg' }),
    ).rejects.toThrow(/401/);
  });
});

describe('selectFileStore', () => {
  it('有 CLOUDINARY_URL → cloudinary;否则 null store', () => {
    expect(
      selectFileStore({
        CLOUDINARY_URL: 'cloudinary://k:s@c',
      }).kind,
    ).toBe('cloudinary');
    expect(selectFileStore({}).kind).toBe('null');
  });
});
