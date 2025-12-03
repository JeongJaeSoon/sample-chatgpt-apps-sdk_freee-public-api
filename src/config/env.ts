import { randomBytes } from 'crypto';

// Load environment variables
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  // Server
  port: parseInt(getEnvVar('PORT', '2091'), 10),
  baseUrl: getEnvVar('BASE_URL', 'http://localhost:2091'),

  // freee OAuth
  freee: {
    clientId: getEnvVar('FREEE_CLIENT_ID', ''),
    clientSecret: getEnvVar('FREEE_CLIENT_SECRET', ''),
    authorizationEndpoint: 'https://accounts.secure.freee.co.jp/public_api/authorize',
    tokenEndpoint: 'https://accounts.secure.freee.co.jp/public_api/token',
    apiBaseUrl: 'https://api.freee.co.jp',
  },

  // JWT
  jwtSecret: getEnvVar('JWT_SECRET', randomBytes(32).toString('hex')),

  // Database
  databasePath: getEnvVar('DATABASE_PATH', './data/app.db'),
};

// OAuth metadata for ChatGPT Apps SDK
export const getOAuthMetadata = () => ({
  issuer: config.baseUrl,
  authorization_endpoint: `${config.baseUrl}/oauth/authorize`,
  token_endpoint: `${config.baseUrl}/oauth/token`,
  registration_endpoint: `${config.baseUrl}/oauth/register`,
  jwks_uri: `${config.baseUrl}/.well-known/jwks.json`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  code_challenge_methods_supported: ['S256'],
  scopes_supported: ['read', 'write', 'default_read'],
});

export const getProtectedResourceMetadata = () => ({
  resource: config.baseUrl,
  authorization_servers: [config.baseUrl],
  scopes_supported: ['read', 'write', 'default_read'],
});
