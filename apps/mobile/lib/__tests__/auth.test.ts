import { describe, expect, it, beforeEach } from '@jest/globals';
import { authHeader, clearToken, getToken, setToken } from '../auth';

// Owner 端会话:登录后拿 JWT,存起来,之后 owner 请求带 Authorization。
// 参与者(/b/token)不经此,始终免登录。

describe('token store', () => {
  beforeEach(() => clearToken());

  it('未登录:无 token、无鉴权头', () => {
    expect(getToken()).toBeNull();
    expect(authHeader()).toEqual({});
  });

  it('设置后:返回 Bearer 头;清除后复位', () => {
    setToken('jwt-123');
    expect(getToken()).toBe('jwt-123');
    expect(authHeader()).toEqual({ authorization: 'Bearer jwt-123' });
    clearToken();
    expect(getToken()).toBeNull();
    expect(authHeader()).toEqual({});
  });
});
