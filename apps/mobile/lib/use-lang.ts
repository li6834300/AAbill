import { useSyncExternalStore } from 'react';
import { getLang, subscribe, t as rawT } from './i18n';
import type { MessageKey } from './locales';

export { getLang, setLang, subscribe, t } from './i18n';
export { LANG_NAMES, LANGS, type Lang } from './locales';

/**
 * 订阅界面语言。组件调用后,语言一变就会重渲染。
 * 返回的 t 与模块级的 t 行为一致,只是绑定在当前渲染上。
 */
export function useLang(): {
  lang: string;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
} {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, t: rawT };
}
