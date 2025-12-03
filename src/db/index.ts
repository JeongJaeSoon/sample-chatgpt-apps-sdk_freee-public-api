import Database, { Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(config.databasePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: DatabaseType = new Database(config.databasePath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  -- OAuth Clients (Dynamic Client Registration)
  CREATE TABLE IF NOT EXISTS oauth_clients (
    id TEXT PRIMARY KEY,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    client_name TEXT,
    redirect_uris TEXT NOT NULL, -- JSON array
    grant_types TEXT NOT NULL, -- JSON array
    response_types TEXT NOT NULL, -- JSON array
    scope TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Authorization Codes (for PKCE flow)
  CREATE TABLE IF NOT EXISTS auth_codes (
    code TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    state TEXT,
    freee_code TEXT, -- The authorization code from freee
    user_id TEXT, -- freee user identifier
    company_id INTEGER, -- freee company ID
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  -- Tokens (mapping our tokens to freee tokens)
  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT,
    company_id INTEGER,
    access_token TEXT NOT NULL, -- Our JWT access token
    refresh_token TEXT, -- Our refresh token
    freee_access_token TEXT NOT NULL, -- freee's access token
    freee_refresh_token TEXT, -- freee's refresh token
    freee_token_expires_at INTEGER,
    scope TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
  CREATE INDEX IF NOT EXISTS idx_auth_codes_client_id ON auth_codes(client_id);
  CREATE INDEX IF NOT EXISTS idx_tokens_client_id ON tokens(client_id);
  CREATE INDEX IF NOT EXISTS idx_tokens_access_token ON tokens(access_token);
`);

export { db };
