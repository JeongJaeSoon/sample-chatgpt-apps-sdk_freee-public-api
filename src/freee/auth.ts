import { config } from '../config/env';

export interface FreeeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

export interface FreeeTokenError {
  error: string;
  error_description?: string;
}

/**
 * Exchange authorization code for tokens with freee
 */
export async function exchangeCodeForTokens(
  authorizationCode: string,
  redirectUri: string
): Promise<FreeeTokenResponse> {
  const response = await fetch(config.freee.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.freee.clientId,
      client_secret: config.freee.clientSecret,
      code: authorizationCode,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as FreeeTokenError;
    throw new Error(`freee token exchange failed: ${error.error} - ${error.error_description || ''}`);
  }

  return data as FreeeTokenResponse;
}

/**
 * Refresh access token with freee
 */
export async function refreshAccessToken(refreshToken: string): Promise<FreeeTokenResponse> {
  const response = await fetch(config.freee.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.freee.clientId,
      client_secret: config.freee.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as FreeeTokenError;
    throw new Error(`freee token refresh failed: ${error.error} - ${error.error_description || ''}`);
  }

  return data as FreeeTokenResponse;
}
