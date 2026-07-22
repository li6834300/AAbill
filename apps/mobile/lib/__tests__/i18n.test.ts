import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// 界面语言:默认跟随系统,用户可自选并持久化。
// 商品名的翻译语言另算(跟随账单,切语言要重新识别)—— 见 bill.translationLang。

const mockLocales = jest.fn<() => Array<{ languageCode: string }>>();
jest.mock('expo-localization', () => ({ getLocales: () => mockLocales() }));

// jest-expo 跑的是原生环境,没有 localStorage —— 自备一个内存实现
class MemoryStorage {
  private map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
  clear = () => this.map.clear();
}
const store = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = store;

// 每个用例都要拿到全新的模块状态(语言是模块级缓存)
const freshI18n = async () => {
  let mod!: typeof import('../i18n');
  await jest.isolateModulesAsync(async () => {
    mod = await import('../i18n');
  });
  return mod;
};

describe('语言探测:默认跟随系统', () => {
  beforeEach(() => {
    store.clear();
    mockLocales.mockReturnValue([{ languageCode: 'en' }]);
  });

  it('系统语言在支持列表里 → 用它', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'nl' }]);
    expect((await freshI18n()).getLang()).toBe('nl');
  });

  it('系统语言带地区码(de-AT)→ 取语言部分', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'de-AT' }]);
    expect((await freshI18n()).getLang()).toBe('de');
  });

  it('不支持的系统语言(法语)→ 回落英文,而不是中文', async () => {
    // 作者是中文用户,但对陌生用户来说英文才是更安全的回落
    mockLocales.mockReturnValue([{ languageCode: 'fr' }]);
    expect((await freshI18n()).getLang()).toBe('en');
  });

  it('拿不到系统语言 → 回落英文,不崩', async () => {
    mockLocales.mockReturnValue([]);
    expect((await freshI18n()).getLang()).toBe('en');
  });
});

describe('用户可自选,且持久化', () => {
  beforeEach(() => {
    store.clear();
    mockLocales.mockReturnValue([{ languageCode: 'en' }]);
  });

  it('选过的语言压过系统语言', async () => {
    const a = await freshI18n();
    a.setLang('zh');
    // 新会话(重新加载模块)仍是中文
    expect((await freshI18n()).getLang()).toBe('zh');
  });

  it('切换会通知订阅者(界面需要重渲染)', async () => {
    const i18n = await freshI18n();
    const seen: string[] = [];
    const off = i18n.subscribe(() => seen.push(i18n.getLang()));
    i18n.setLang('de');
    i18n.setLang('nl');
    off();
    i18n.setLang('zh');
    expect(seen).toEqual(['de', 'nl']); // 退订后不再收到
  });

  it('存储不可用时不崩(原生无 localStorage)', async () => {
    const i18n = await freshI18n();
    const spy = jest.spyOn(store, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => i18n.setLang('de')).not.toThrow();
    expect(i18n.getLang()).toBe('de'); // 内存态仍然生效
    spy.mockRestore();
  });
});

describe('t():取文案', () => {
  beforeEach(() => {
    store.clear();
    mockLocales.mockReturnValue([{ languageCode: 'en' }]);
  });

  it('按当前语言取,切换后跟着变', async () => {
    const { t, setLang } = await freshI18n();
    setLang('zh');
    expect(t('bill.upload')).toMatch(/发票/);
    setLang('de');
    expect(t('bill.upload')).toMatch(/Rechnung/i);
  });

  it('支持占位符', async () => {
    const { t, setLang } = await freshI18n();
    setLang('zh');
    expect(t('claim.remaining', { n: 3 })).toContain('3');
  });

  it('四种语言的键集合完全一致 —— 漏译即失败', async () => {
    const { CATALOGS, LANGS } = await freshI18n();
    const base = Object.keys(CATALOGS.en).sort();
    expect(base.length).toBeGreaterThan(20);
    for (const lang of LANGS) {
      expect(Object.keys(CATALOGS[lang]).sort(), lang).toEqual(base);
    }
  });

  it('没有任何一条文案是空串', async () => {
    const { CATALOGS, LANGS } = await freshI18n();
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(CATALOGS[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe('');
      }
    }
  });
});
