import { db } from '../index';
import { randomBytes } from 'crypto';

export interface AuthCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  scope: string | null;
  code_challenge: string;
  code_challenge_method: string;
  state: string | null;
  freee_code: string | null;
  user_id: string | null;
  company_id: number | null;
  created_at: number;
  expires_at: number;
  used: number;
}

export interface CreateAuthCodeRequest {
  client_id: string;
  redirect_uri: string;
  scope?: string;
  code_challenge: string;
  code_challenge_method?: string;
  state?: string;
}

// Code expires in 10 minutes
const CODE_EXPIRY_SECONDS = 600;

export const authCodeModel = {
  create(request: CreateAuthCodeRequest): AuthCode {
    const code = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + CODE_EXPIRY_SECONDS;

    const authCode: AuthCode = {
      code,
      client_id: request.client_id,
      redirect_uri: request.redirect_uri,
      scope: request.scope || null,
      code_challenge: request.code_challenge,
      code_challenge_method: request.code_challenge_method || 'S256',
      state: request.state || null,
      freee_code: null,
      user_id: null,
      company_id: null,
      created_at: now,
      expires_at: expiresAt,
      used: 0,
    };

    const stmt = db.prepare(`
      INSERT INTO auth_codes (code, client_id, redirect_uri, scope, code_challenge, code_challenge_method, state, freee_code, user_id, company_id, created_at, expires_at, used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      authCode.code,
      authCode.client_id,
      authCode.redirect_uri,
      authCode.scope,
      authCode.code_challenge,
      authCode.code_challenge_method,
      authCode.state,
      authCode.freee_code,
      authCode.user_id,
      authCode.company_id,
      authCode.created_at,
      authCode.expires_at,
      authCode.used
    );

    return authCode;
  },

  findByCode(code: string): AuthCode | null {
    const stmt = db.prepare(`
      SELECT * FROM auth_codes WHERE code = ?
    `);

    return stmt.get(code) as AuthCode | null;
  },

  updateWithFreeeData(code: string, freeeCode: string, userId: string | null, companyId: number | null): void {
    const stmt = db.prepare(`
      UPDATE auth_codes SET freee_code = ?, user_id = ?, company_id = ? WHERE code = ?
    `);

    stmt.run(freeeCode, userId, companyId, code);
  },

  markAsUsed(code: string): void {
    const stmt = db.prepare(`
      UPDATE auth_codes SET used = 1 WHERE code = ?
    `);

    stmt.run(code);
  },

  isValid(authCode: AuthCode): boolean {
    const now = Math.floor(Date.now() / 1000);
    return authCode.used === 0 && authCode.expires_at > now;
  },

  // Clean up expired codes
  cleanupExpired(): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
      DELETE FROM auth_codes WHERE expires_at < ? OR used = 1
    `);

    stmt.run(now - 3600); // Keep used codes for 1 hour for debugging
  },
};
