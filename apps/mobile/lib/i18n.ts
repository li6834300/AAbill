import { getLocales } from 'expo-localization';
import { CATALOGS, LANGS, type Lang, type MessageKey } from './locales';

export {
  CATALOGS,
  LANGS,
  LANG_NAMES,
  type Lang,
  type MessageKey,
} from './locales';

// 界面语言:默认跟随系统,用户可自选并持久化(与登录令牌同样的存储策略)。
//
// 商品名的翻译语言不在这里 —— 那跟着账单走(识别时定下),切界面语言不会重译
// 已识别的商品名,需要重新识别整张发票。见 bill.translationLang。

const KEY = 'aabill_lang';

const isLang = (v: string): v is Lang =>
  (LANGS as readonly string[]).includes(v);

/** 系统语言;'de-AT' 这类带地区码的取语言部分。不支持就回落英文。 */
function systemLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode ?? '';
    const base = code.toLowerCase().split('-')[0] ?? '';
    return isLang(base) ? base : 'en';
  } catch {
    return 'en';
  }
}

function stored(): Lang | null {
  try {
    const v =
      typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return v && isLang(v) ? v : null;
  } catch {
    return null;
  }
}

let lang: Lang = stored() ?? systemLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, next);
  } catch {
    // 原生无 localStorage:仅内存态,本次会话内仍然生效
  }
  for (const fn of listeners) fn();
}

/** 订阅语言变化(界面据此重渲染);返回退订函数。 */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** 取文案。占位符写作 {name},用 params 填充。 */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const raw = CATALOGS[lang][key];
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
