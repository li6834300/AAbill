import { t } from './i18n';

export interface FriendlyError {
  /** 给用户看的人话 */
  message: string;
  /** 原始错误文本,放到「详情」里备查 */
  raw: string;
}

/**
 * 把 fetch/API 抛出的原始错误映射成人话,原文留在 raw 供「详情」展开。
 * 取代散落各处的 setError(String(e)) —— 那会把 "Error: fetch failed…" 直接甩给用户。
 */
export function errorMessage(e: unknown): FriendlyError {
  const text = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const probe = e instanceof Error ? e.message : String(e);

  if (/failed to fetch|network|fetch failed|networkerror/i.test(probe)) {
    return { message: t('error.network'), raw: text };
  }
  if (/\b401\b|unauthorized|403|forbidden/i.test(probe)) {
    return { message: t('error.auth'), raw: text };
  }
  if (/\b409\b|conflict/i.test(probe)) {
    return { message: t('error.conflict'), raw: text };
  }
  return { message: t('error.generic'), raw: text };
}
