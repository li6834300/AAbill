// Owner 会话令牌存储。Web 持久化到 localStorage(刷新不丢);原生为内存态(开发够用)。
// Participant 认领页不使用本模块 —— 始终免登录。

const KEY = 'aabill_token';

const persisted = (): string | null => {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(KEY)
      : null;
  } catch {
    return null;
  }
};

let token: string | null = persisted();

export function getToken(): string | null {
  return token;
}

export function setToken(value: string): void {
  token = value;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, value);
  } catch {
    // 原生无 localStorage:仅内存态
  }
}

export function clearToken(): void {
  token = null;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}

/** owner 请求的鉴权头;未登录返回空对象。 */
export function authHeader(): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}
