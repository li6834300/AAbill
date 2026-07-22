import { TAX_COUNTRY_NAMES, type TaxCountry } from '@aabill/core';
import { getLang } from './i18n';

/**
 * 按当前界面语言给出国名。
 *
 * 用 Intl.DisplayNames 而不是手写表:32 国 × 4 语言 = 128 条,
 * 手写既啰嗦又容易漏、容易错,而这份数据浏览器/运行时本来就带着。
 * 运行时没有 Intl(部分 Hermes 构建)时回落到上游给的英文名。
 */
export function countryName(code: TaxCountry): string {
  try {
    return (
      new Intl.DisplayNames([getLang()], { type: 'region' }).of(code) ??
      TAX_COUNTRY_NAMES[code]
    );
  } catch {
    return TAX_COUNTRY_NAMES[code];
  }
}

/**
 * 语言名,按当前界面语言表述(界面为中文时,'de' → "德语")。
 * 同样交给 Intl,不手写 4×4 的对照表。
 */
export function languageName(code: string): string {
  try {
    return (
      new Intl.DisplayNames([getLang()], { type: 'language' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
