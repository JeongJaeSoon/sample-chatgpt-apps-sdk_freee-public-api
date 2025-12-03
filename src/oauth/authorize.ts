import { Router, Request, Response } from 'express';
import { clientModel } from '../db/models/client';
import { authCodeModel } from '../db/models/authCode';
import { isValidCodeChallenge, CodeChallengeMethod } from './pkce';
import { config } from '../config/env';

const router = Router();

interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge: string;
  code_challenge_method?: string;
  resource?: string; // Resource parameter for MCP
}

/**
 * Authorization endpoint
 * Handles the initial authorization request from ChatGPT
 */
router.get('/oauth/authorize', (req: Request, res: Response) => {
  try {
    const query = req.query as unknown as AuthorizationRequest;

    // Validate required parameters
    if (!query.response_type || query.response_type !== 'code') {
      return redirectWithError(res, query.redirect_uri, 'unsupported_response_type', 'Only code response_type is supported', query.state);
    }

    if (!query.client_id) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
    }

    if (!query.redirect_uri) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
    }

    if (!query.code_challenge) {
      return redirectWithError(res, query.redirect_uri, 'invalid_request', 'code_challenge is required (PKCE)', query.state);
    }

    // Validate code_challenge_method
    const codeChallengeMethod = (query.code_challenge_method || 'S256') as CodeChallengeMethod;
    if (codeChallengeMethod !== 'S256') {
      return redirectWithError(res, query.redirect_uri, 'invalid_request', 'Only S256 code_challenge_method is supported', query.state);
    }

    // Validate code_challenge format
    if (!isValidCodeChallenge(query.code_challenge, codeChallengeMethod)) {
      return redirectWithError(res, query.redirect_uri, 'invalid_request', 'Invalid code_challenge format', query.state);
    }

    // Validate client
    const client = clientModel.findByClientId(query.client_id);
    if (!client) {
      return res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
    }

    // Validate redirect_uri
    if (!clientModel.validateRedirectUri(client, query.redirect_uri)) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri does not match registered URIs' });
    }

    // Create our authorization code entry (we'll update it after freee auth)
    const authCode = authCodeModel.create({
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      scope: query.scope,
      code_challenge: query.code_challenge,
      code_challenge_method: codeChallengeMethod,
      state: query.state,
    });

    // Build freee authorization URL
    const freeeAuthUrl = new URL(config.freee.authorizationEndpoint);
    freeeAuthUrl.searchParams.set('response_type', 'code');
    freeeAuthUrl.searchParams.set('client_id', config.freee.clientId);
    freeeAuthUrl.searchParams.set('redirect_uri', `${config.baseUrl}/oauth/callback`);
    freeeAuthUrl.searchParams.set('state', authCode.code); // Use our code as state to track the flow
    freeeAuthUrl.searchParams.set('prompt', 'select_company'); // Allow company selection

    console.log(`[Auth] Redirecting to freee authorization for client: ${query.client_id}`);

    // Redirect to freee
    res.redirect(freeeAuthUrl.toString());
  } catch (error) {
    console.error('[Auth] Error in authorization:', error);
    res.status(500).json({ error: 'server_error', error_description: 'An unexpected error occurred' });
  }
});

/**
 * Callback from freee OAuth
 * Receives the authorization code from freee and redirects back to ChatGPT
 */
router.get('/oauth/callback', (req: Request, res: Response) => {
  try {
    const { code: freeeCode, state, error, error_description } = req.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // state contains our auth code
    if (!state) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing state parameter' });
    }

    // Find our authorization code entry
    const authCode = authCodeModel.findByCode(state as string);
    if (!authCode) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid or expired state' });
    }

    // Check if freee returned an error
    if (error) {
      console.error(`[Auth] freee authorization error: ${error} - ${error_description}`);
      return redirectWithError(
        res,
        authCode.redirect_uri,
        'access_denied',
        error_description || 'Authorization was denied',
        authCode.state || undefined
      );
    }

    if (!freeeCode) {
      return redirectWithError(
        res,
        authCode.redirect_uri,
        'server_error',
        'No authorization code received from freee',
        authCode.state || undefined
      );
    }

    // Update our auth code with freee's code
    authCodeModel.updateWithFreeeData(authCode.code, freeeCode as string, null, null);

    console.log(`[Auth] Received freee authorization code, redirecting to client`);

    // Redirect back to the client (ChatGPT) with our authorization code
    const redirectUrl = new URL(authCode.redirect_uri);
    redirectUrl.searchParams.set('code', authCode.code);
    if (authCode.state) {
      redirectUrl.searchParams.set('state', authCode.state);
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[Auth] Error in callback:', error);
    res.status(500).json({ error: 'server_error', error_description: 'An unexpected error occurred' });
  }
});

function redirectWithError(
  res: Response,
  redirectUri: string | undefined,
  error: string,
  errorDescription: string,
  state?: string
): void {
  if (!redirectUri) {
    res.status(400).json({ error, error_description: errorDescription });
    return;
  }

  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', errorDescription);
  if (state) {
    url.searchParams.set('state', state);
  }
  res.redirect(url.toString());
}

export { router as authorizeRouter };
