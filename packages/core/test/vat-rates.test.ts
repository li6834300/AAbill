import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAX_RATES,
  isReducedRateAmbiguous,
  TAX_COUNTRIES,
  VAT_RATES_SOURCE,
  reducedRateOptions,
} from '../src/index.js';

// 税率表不再靠人写,而是从欧委会 TEDB 同步生成(scripts/sync-vat-rates.mjs)。
// 起因:凭记忆填的表里,罗马尼亚标准税率停在 19%,而 2025 年已调到 21% ——
// 这类错误不会报错,只会静静算错钱。故这里断言的是**数据的新鲜度与自洽性**,
// 不是我记得的数字;具体数值以生成物为准。

/** 超过这个天数不同步就算过期 —— 宁可 CI 红,也不要悄悄用着过时税率算钱。 */
const MAX_AGE_DAYS = 180;

describe('税率数据来源可追溯', () => {
  it('标注了上游与抓取日期', () => {
    expect(VAT_RATES_SOURCE.name).toMatch(/TEDB/i);
    expect(VAT_RATES_SOURCE.url).toMatch(/^https:\/\//);
    expect(VAT_RATES_SOURCE.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it(`数据不早于 ${MAX_AGE_DAYS} 天 —— 过期即失败,逼着去同步`, () => {
    const ageDays =
      (Date.now() - Date.parse(VAT_RATES_SOURCE.version)) / 86_400_000;
    expect(ageDays).toBeLessThan(MAX_AGE_DAYS);
    expect(ageDays).toBeGreaterThanOrEqual(0); // 不接受未来日期
  });
});

describe('生成的税率表自洽', () => {
  it('覆盖 EU-27 全体,外加英国瑞士挪威', () => {
    for (const c of ['DE', 'NL', 'FR', 'IT', 'ES', 'PL', 'RO'] as const) {
      expect(TAX_COUNTRIES).toContain(c);
    }
    for (const c of ['GB', 'CH', 'NO'] as const) {
      expect(TAX_COUNTRIES).toContain(c);
    }
    expect(TAX_COUNTRIES.length).toBeGreaterThanOrEqual(30);
  });

  it('全部为整数基点,低税率不高于标准税率', () => {
    for (const c of TAX_COUNTRIES) {
      const r = DEFAULT_TAX_RATES[c];
      expect(Number.isInteger(r.A), c).toBe(true);
      expect(Number.isInteger(r.B), c).toBe(true);
      expect(r.A, c).toBeGreaterThan(0);
      expect(r.A, c).toBeLessThanOrEqual(2800);
      expect(r.B, c).toBeLessThanOrEqual(r.A);
    }
  });

  it('没有低税率档的国家(丹麦),B 回落到标准税率', () => {
    expect(DEFAULT_TAX_RATES.DK.B).toBe(DEFAULT_TAX_RATES.DK.A);
  });

  it('只有一档低税率的国家,兜底值就是那一档', () => {
    expect(DEFAULT_TAX_RATES.DE.B).toBe(700);
    expect(DEFAULT_TAX_RATES.NL.B).toBe(900);
  });

  it('罗马尼亚标准税率取自上游,不是我记的 19%', () => {
    // 回归:2025 年 RO 调到 21%,凭记忆填的表错了整整两个百分点
    expect(DEFAULT_TAX_RATES.RO.A).toBe(2100);
  });
});

describe('reducedRateOptions:一国可能有多档低税率', () => {
  it('列出该国全部低税率(升序,基点)', () => {
    // 卢森堡上游为 super_reduced 3% + reduced [8, 14]
    expect(reducedRateOptions('LU')).toEqual([300, 800, 1400]);
  });

  it('德国只有一档', () => {
    expect(reducedRateOptions('DE')).toEqual([700]);
  });

  it('丹麦没有低税率档:空数组', () => {
    expect(reducedRateOptions('DK')).toEqual([]);
  });

  it('兜底的 B 必须是该国真实存在的一档', () => {
    for (const c of TAX_COUNTRIES) {
      const opts = reducedRateOptions(c);
      if (opts.length > 0) expect(opts, c).toContain(DEFAULT_TAX_RATES[c].B);
    }
  });
});

describe('多档低税率无法自动判定,必须问用户', () => {
  // 法国上游给出 [0.9, 1.05, 5.5, 8.5, 10, 13](含海外省与科西嘉特别税率)。
  // 「哪一档适用于食品」推导不出来 —— 取最低会选中 0.9%,荒谬。
  // 所以:唯一一档才自动用,多档一律交给用户选。
  it('德国荷兰只有一档 → 不含糊', () => {
    expect(isReducedRateAmbiguous('DE')).toBe(false);
    expect(isReducedRateAmbiguous('NL')).toBe(false);
  });

  it('丹麦没有低税率档 → 也不含糊(B 就等于标准税率)', () => {
    expect(isReducedRateAmbiguous('DK')).toBe(false);
  });

  it('法国多档 → 含糊,不许替用户猜', () => {
    expect(isReducedRateAmbiguous('FR')).toBe(true);
    expect(reducedRateOptions('FR')).toContain(550); // 5.5% 确实在候选里
    expect(reducedRateOptions('FR').length).toBeGreaterThan(1);
  });
});
