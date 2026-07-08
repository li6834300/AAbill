import { verifyWithJwks } from 'hono/jwt';
import type { IdentityVerifier } from './verifier.js';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * 校验 Google 登录返回的 id token(RS256):
 * 用 Google 公钥(JWKS)验签,再校验 iss / aud(= 我们的 client id)/ email。
 * 客户端拿 token 的方式(GIS / expo-auth-session)与此无关。
 */
export function createGoogleVerifier(
  clientId: string,
  jwksUri: string = GOOGLE_JWKS_URI,
): IdentityVerifier {
  return {
    async verify(_provider, idToken) {
      const payload = await verifyWithJwks(idToken, {
        jwks_uri: jwksUri,
        allowedAlgorithms: ['RS256'],
      });
      if (!GOOGLE_ISS.includes(String(payload.iss))) {
        throw new Error('Google token iss 不合法');
      }
      if (payload.aud !== clientId) {
        throw new Error('Google token aud 与 client id 不匹配');
      }
      if (typeof payload.email !== 'string' || !payload.email) {
        throw new Error('Google token 缺 email');
      }
      return { sub: String(payload.sub), email: payload.email };
    },
  };
}
