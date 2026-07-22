// Web-only Google 登录(Google Identity Services)。原生端走别的流程(暂未做)。
// GIS 把"用 Google 登录"按钮渲染进一个 DOM 元素,登录后回调返回 id token(JWT)。

import { t } from './i18n';

interface GisId {
  initialize(opts: {
    client_id: string;
    callback: (resp: { credential: string }) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    opts: { theme?: string; size?: string; width?: number },
  ): void;
}

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(t('login.googleScriptFailed')));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** 在指定 DOM 元素里渲染 Google 登录按钮;登录成功时用 id token 回调。 */
export async function renderGoogleButton(
  element: HTMLElement,
  clientId: string,
  onIdToken: (idToken: string) => void,
): Promise<void> {
  await loadGis();
  const gis = (
    globalThis as unknown as { google?: { accounts?: { id?: GisId } } }
  ).google?.accounts?.id;
  if (!gis) throw new Error(t('login.googleUnavailable'));
  gis.initialize({
    client_id: clientId,
    callback: (resp) => onIdToken(resp.credential),
  });
  gis.renderButton(element, { theme: 'outline', size: 'large', width: 260 });
}
