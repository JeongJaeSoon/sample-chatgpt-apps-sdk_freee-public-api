import { db } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

export interface Token {
  id: string;
  client_id: string;
  user_id: string | null;
  company_id: number | null;
  access_token: string;
  refresh_token: string | null;
  freee_access_token: string;
  freee_refresh_token: string | null;
  freee_token_expires_at: number | null;
  scope: string | null;
  created_at: number;
  expires_at: number;
  revoked: number;
}

export interface CreateTokenRequest {
  client_id: string;
  user_id?: string;
  company_id?: number;
  access_token: string;
  refresh_token?: string;
  freee_access_token: string;
  freee_refresh_token?: string;
  freee_token_expires_at?: number;
  scope?: string;
  expires_in: number; // seconds
}

export const tokenModel = {
  create(request: CreateTokenRequest): Token {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + request.expires_in;
    const refreshToken = request.refresh_token || randomBytes(32).toString('hex');

    const token: Token = {
      id,
      client_id: request.client_id,
      user_id: request.user_id || null,
      company_id: request.company_id || null,
      access_token: request.access_token,
      refresh_token: refreshToken,
      freee_access_token: request.freee_access_token,
      freee_refresh_token: request.freee_refresh_token || null,
      freee_token_expires_at: request.freee_token_expires_at || null,
      scope: request.scope || null,
      created_at: now,
      expires_at: expiresAt,
      revoked: 0,
    };

    const stmt = db.prepare(`
      INSERT INTO tokens (id, client_id, user_id, company_id, access_token, refresh_token, freee_access_token, freee_refresh_token, freee_token_expires_at, scope, created_at, expires_at, revoked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      token.id,
      token.client_id,
      token.user_id,
      token.company_id,
      token.access_token,
      token.refresh_token,
      token.freee_access_token,
      token.freee_refresh_token,
      token.freee_token_expires_at,
      token.scope,
      token.created_at,
      token.expires_at,
      token.revoked
    );

    return token;
  },

  findByAccessToken(accessToken: string): Token | null {
    const stmt = db.prepare(`
      SELECT * FROM tokens WHERE access_token = ? AND revoked = 0
    `);

    return stmt.get(accessToken) as Token | null;
  },

  findByRefreshToken(refreshToken: string): Token | null {
    const stmt = db.prepare(`
      SELECT * FROM tokens WHERE refresh_token = ? AND revoked = 0
    `);

    return stmt.get(refreshToken) as Token | null;
  },

  updateFreeeTokens(id: string, freeeAccessToken: string, freeeRefreshToken: string | null, freeeTokenExpiresAt: number | null): void {
    const stmt = db.prepare(`
      UPDATE tokens SET freee_access_token = ?, freee_refresh_token = ?, freee_token_expires_at = ? WHERE id = ?
    `);

    stmt.run(freeeAccessToken, freeeRefreshToken, freeeTokenExpiresAt, id);
  },

  revoke(id: string): void {
    const stmt = db.prepare(`
      UPDATE tokens SET revoked = 1 WHERE id = ?
    `);

    stmt.run(id);
  },

  revokeByRefreshToken(refreshToken: string): void {
    const stmt = db.prepare(`
      UPDATE tokens SET revoked = 1 WHERE refresh_token = ?
    `);

    stmt.run(refreshToken);
  },

  isValid(token: Token): boolean {
    const now = Math.floor(Date.now() / 1000);
    return token.revoked === 0 && token.expires_at > now;
  },

  // Clean up expired and revoked tokens
  cleanupExpired(): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
      DELETE FROM tokens WHERE expires_at < ? OR revoked = 1
    `);

    stmt.run(now - 86400); // Keep for 1 day for debugging
  },
};
