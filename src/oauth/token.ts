import { Router, Request, Response } from 'express';
import { SignJWT } from 'jose';
import { clientModel } from '../db/models/client';
import { authCodeModel } from '../db/models/authCode';
import { tokenModel } from '../db/models/token';
import { verifyCodeChallenge, CodeChallengeMethod } from './pkce';
import { exchangeCodeForTokens, refreshAccessToken } from '../freee/auth';
import { config } from '../config/env';

const router = Router();

interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
  resource?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface TokenError {
  error: string;
  error_description?: string;
}

// JWT secret as Uint8Array
const jwtSecretKey = new TextEncoder().encode(config.jwtSecret);

/**
 * Token endpoint
 * Handles token exchange and refresh
 */
router.post('/oauth/token', async (req: Request, res: Response) => {
  try {
    // Parse request body (supports both JSON and form-urlencoded)
    const body: TokenRequest = req.body;

    // Extract client credentials from Authorization header if present
    let clientId = body.client_id;
    let clientSecret = body.client_secret;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
      const [headerClientId, headerClientSecret] = credentials.split(':');
      clientId = clientId || headerClientId;
      clientSecret = clientSecret || headerClientSecret;
    }

    if (!body.grant_type) {
      return sendError(res, 400, 'invalid_request', 'grant_type is required');
    }

    if (body.grant_type === 'authorization_code') {
      return handleAuthorizationCodeGrant(req, res, body, clientId, clientSecret);
    } else if (body.grant_type === 'refresh_token') {
      return handleRefreshTokenGrant(req, res, body, clientId, clientSecret);
    } else {
      return sendError(res, 400, 'unsupported_grant_type', `Unsupported grant_type: ${body.grant_type}`);
    }
  } catch (error) {
    console.error('[Token] Error:', error);
    return sendError(res, 500, 'server_error', 'An unexpected error occurred');
  }
});

async function handleAuthorizationCodeGrant(
  req: Request,
  res: Response,
  body: TokenRequest,
  clientId?: string,
  clientSecret?: string
): Promise<void> {
  // Validate required parameters
  if (!body.code) {
    return sendError(res, 400, 'invalid_request', 'code is required');
  }

  if (!body.redirect_uri) {
    return sendError(res, 400, 'invalid_request', 'redirect_uri is required');
  }

  if (!body.code_verifier) {
    return sendError(res, 400, 'invalid_request', 'code_verifier is required (PKCE)');
  }

  if (!clientId) {
    return sendError(res, 400, 'invalid_request', 'client_id is required');
  }

  // Find and validate authorization code
  const authCode = authCodeModel.findByCode(body.code);
  if (!authCode) {
    return sendError(res, 400, 'invalid_grant', 'Invalid or expired authorization code');
  }

  if (!authCodeModel.isValid(authCode)) {
    return sendError(res, 400, 'invalid_grant', 'Authorization code has expired or already been used');
  }

  // Validate client
  if (authCode.client_id !== clientId) {
    return sendError(res, 400, 'invalid_grant', 'Authorization code was not issued to this client');
  }

  // Validate redirect_uri
  if (authCode.redirect_uri !== body.redirect_uri) {
    return sendError(res, 400, 'invalid_grant', 'redirect_uri does not match');
  }

  // Verify PKCE code_verifier
  const isValidPKCE = verifyCodeChallenge(
    body.code_verifier,
    authCode.code_challenge,
    authCode.code_challenge_method as CodeChallengeMethod
  );

  if (!isValidPKCE) {
    return sendError(res, 400, 'invalid_grant', 'Invalid code_verifier');
  }

  // Mark authorization code as used
  authCodeModel.markAsUsed(authCode.code);

  // Exchange freee authorization code for tokens
  if (!authCode.freee_code) {
    return sendError(res, 400, 'invalid_grant', 'No freee authorization code available');
  }

  let freeeTokens;
  try {
    freeeTokens = await exchangeCodeForTokens(authCode.freee_code, `${config.baseUrl}/oauth/callback`);
  } catch (error) {
    console.error('[Token] freee token exchange failed:', error);
    return sendError(res, 400, 'invalid_grant', 'Failed to exchange authorization code with freee');
  }

  // Create our JWT access token
  const expiresIn = 3600; // 1 hour
  const now = Math.floor(Date.now() / 1000);

  const accessToken = await new SignJWT({
    sub: authCode.user_id || 'user',
    client_id: clientId,
    scope: authCode.scope || 'read write',
    company_id: authCode.company_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(now + expiresIn)
    .setIssuer(config.baseUrl)
    .setAudience(config.baseUrl)
    .sign(jwtSecretKey);

  // Store token mapping
  const token = tokenModel.create({
    client_id: clientId,
    user_id: authCode.user_id || undefined,
    company_id: authCode.company_id || undefined,
    access_token: accessToken,
    freee_access_token: freeeTokens.access_token,
    freee_refresh_token: freeeTokens.refresh_token,
    freee_token_expires_at: freeeTokens.created_at + freeeTokens.expires_in,
    scope: authCode.scope || undefined,
    expires_in: expiresIn,
  });

  console.log(`[Token] Issued access token for client: ${clientId}`);

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: token.refresh_token || undefined,
    scope: authCode.scope || undefined,
  };

  res.json(response);
}

async function handleRefreshTokenGrant(
  req: Request,
  res: Response,
  body: TokenRequest,
  clientId?: string,
  clientSecret?: string
): Promise<void> {
  if (!body.refresh_token) {
    return sendError(res, 400, 'invalid_request', 'refresh_token is required');
  }

  if (!clientId) {
    return sendError(res, 400, 'invalid_request', 'client_id is required');
  }

  // Find the existing token
  const existingToken = tokenModel.findByRefreshToken(body.refresh_token);
  if (!existingToken) {
    return sendError(res, 400, 'invalid_grant', 'Invalid refresh token');
  }

  if (existingToken.client_id !== clientId) {
    return sendError(res, 400, 'invalid_grant', 'Refresh token was not issued to this client');
  }

  // Refresh freee token
  if (!existingToken.freee_refresh_token) {
    return sendError(res, 400, 'invalid_grant', 'No freee refresh token available');
  }

  let freeeTokens;
  try {
    freeeTokens = await refreshAccessToken(existingToken.freee_refresh_token);
  } catch (error) {
    console.error('[Token] freee token refresh failed:', error);
    // Revoke our token if freee refresh fails
    tokenModel.revoke(existingToken.id);
    return sendError(res, 400, 'invalid_grant', 'Failed to refresh freee token');
  }

  // Create new JWT access token
  const expiresIn = 3600; // 1 hour
  const now = Math.floor(Date.now() / 1000);

  const accessToken = await new SignJWT({
    sub: existingToken.user_id || 'user',
    client_id: clientId,
    scope: existingToken.scope || 'read write',
    company_id: existingToken.company_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(now + expiresIn)
    .setIssuer(config.baseUrl)
    .setAudience(config.baseUrl)
    .sign(jwtSecretKey);

  // Revoke old token and create new one
  tokenModel.revoke(existingToken.id);

  const newToken = tokenModel.create({
    client_id: clientId,
    user_id: existingToken.user_id || undefined,
    company_id: existingToken.company_id || undefined,
    access_token: accessToken,
    freee_access_token: freeeTokens.access_token,
    freee_refresh_token: freeeTokens.refresh_token,
    freee_token_expires_at: freeeTokens.created_at + freeeTokens.expires_in,
    scope: existingToken.scope || undefined,
    expires_in: expiresIn,
  });

  console.log(`[Token] Refreshed access token for client: ${clientId}`);

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: newToken.refresh_token || undefined,
    scope: existingToken.scope || undefined,
  };

  res.json(response);
}

function sendError(res: Response, status: number, error: string, errorDescription: string): void {
  const errorResponse: TokenError = {
    error,
    error_description: errorDescription,
  };
  res.status(status).json(errorResponse);
}

export { router as tokenRouter };
