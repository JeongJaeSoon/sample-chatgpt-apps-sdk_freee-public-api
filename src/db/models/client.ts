import { db } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateClientRequest {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}

export const clientModel = {
  create(request: CreateClientRequest): OAuthClient {
    const id = uuidv4();
    const clientId = `chatgpt_${randomBytes(16).toString('hex')}`;
    const clientSecret = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    const client: OAuthClient = {
      id,
      client_id: clientId,
      client_secret: clientSecret,
      client_name: request.client_name || null,
      redirect_uris: request.redirect_uris,
      grant_types: request.grant_types || ['authorization_code', 'refresh_token'],
      response_types: request.response_types || ['code'],
      scope: request.scope || 'read write',
      created_at: now,
      updated_at: now,
    };

    const stmt = db.prepare(`
      INSERT INTO oauth_clients (id, client_id, client_secret, client_name, redirect_uris, grant_types, response_types, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      client.id,
      client.client_id,
      client.client_secret,
      client.client_name,
      JSON.stringify(client.redirect_uris),
      JSON.stringify(client.grant_types),
      JSON.stringify(client.response_types),
      client.scope,
      client.created_at,
      client.updated_at
    );

    return client;
  },

  findByClientId(clientId: string): OAuthClient | null {
    const stmt = db.prepare(`
      SELECT * FROM oauth_clients WHERE client_id = ?
    `);

    const row = stmt.get(clientId) as any;
    if (!row) return null;

    return {
      ...row,
      redirect_uris: JSON.parse(row.redirect_uris),
      grant_types: JSON.parse(row.grant_types),
      response_types: JSON.parse(row.response_types),
    };
  },

  validateCredentials(clientId: string, clientSecret: string): OAuthClient | null {
    const client = this.findByClientId(clientId);
    if (!client) return null;
    if (client.client_secret !== clientSecret) return null;
    return client;
  },

  validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
    return client.redirect_uris.includes(redirectUri);
  },
};
