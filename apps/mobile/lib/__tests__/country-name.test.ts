import { describe, expect, it } from '@jest/globals';
import { TAX_COUNTRIES } from '@aabill/core';
import { countryName } from '../country-name';
import { setLang } from '../i18n';

// 国名不手写:Intl.DisplayNames 内置了各语言的国家名,
// 32 国 × 4 语言 = 128 条,手写既啰嗦又容易漏和错。

describe('countryName', () => {
  it('按当前界面语言给出国名', () => {
    setLang('zh');
    expect(countryName('DE')).toBe('德国');
    setLang('de');
    expect(countryName('DE')).toBe('Deutschland');
    setLang('nl');
    expect(countryName('DE')).toBe('Duitsland');
    setLang('en');
    expect(countryName('DE')).toBe('Germany');
  });

  it('所有支持的国家在四种语言下都有非空名字', () => {
    const blanks: string[] = [];
    for (const lang of ['zh', 'en', 'nl', 'de'] as const) {
      setLang(lang);
      for (const c of TAX_COUNTRIES) {
        const name = countryName(c);
        if (!name.trim()) blanks.push(`${lang}.${c}`);
      }
    }
    expect(blanks).toEqual([]);
  });

  it('国名不应只是回落成国家码', () => {
    setLang('zh');
    const sameAsCode = TAX_COUNTRIES.filter((c) => countryName(c) === c);
    expect(sameAsCode).toEqual([]);
  });
});
