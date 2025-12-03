import { createHash } from 'crypto';

/**
 * PKCE (Proof Key for Code Exchange) implementation
 * https://datatracker.ietf.org/doc/html/rfc7636
 */

export type CodeChallengeMethod = 'S256' | 'plain';

/**
 * Verify the code_verifier against the stored code_challenge
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: CodeChallengeMethod = 'S256'
): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  if (method === 'S256') {
    const computed = computeS256Challenge(codeVerifier);
    return computed === codeChallenge;
  }

  return false;
}

/**
 * Compute S256 code challenge from verifier
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function computeS256Challenge(codeVerifier: string): string {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Base64 URL encoding (RFC 4648)
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Validate code_verifier format
 * Must be 43-128 characters, using only [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false;
  }

  const validChars = /^[A-Za-z0-9\-._~]+$/;
  return validChars.test(codeVerifier);
}

/**
 * Validate code_challenge format
 * For S256: Base64URL encoded, 43 characters
 */
export function isValidCodeChallenge(codeChallenge: string, method: CodeChallengeMethod = 'S256'): boolean {
  if (method === 'S256') {
    // S256 produces a 32-byte hash, which is 43 characters in base64url (without padding)
    if (codeChallenge.length !== 43) {
      return false;
    }
    const validBase64Url = /^[A-Za-z0-9\-_]+$/;
    return validBase64Url.test(codeChallenge);
  }

  if (method === 'plain') {
    return isValidCodeVerifier(codeChallenge);
  }

  return false;
}
