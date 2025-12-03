import { Router, Request, Response } from 'express';
import { clientModel, CreateClientRequest } from '../db/models/client';
import { config } from '../config/env';

const router = Router();

interface DCRRequest {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
  // Additional metadata fields that ChatGPT might send
  software_id?: string;
  software_version?: string;
}

interface DCRResponse {
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope?: string;
  token_endpoint_auth_method: string;
}

interface DCRError {
  error: string;
  error_description?: string;
}

/**
 * Dynamic Client Registration endpoint
 * https://datatracker.ietf.org/doc/html/rfc7591
 */
router.post('/oauth/register', (req: Request, res: Response) => {
  try {
    const body = req.body as DCRRequest;

    // Validate required fields
    if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      const error: DCRError = {
        error: 'invalid_client_metadata',
        error_description: 'redirect_uris is required and must be a non-empty array',
      };
      res.status(400).json(error);
      return;
    }

    // Validate redirect URIs (must be HTTPS in production)
    for (const uri of body.redirect_uris) {
      try {
        const url = new URL(uri);
        // Allow http for localhost/development
        if (url.protocol !== 'https:' && !url.hostname.includes('localhost') && url.hostname !== '127.0.0.1') {
          const error: DCRError = {
            error: 'invalid_redirect_uri',
            error_description: `Redirect URI must use HTTPS: ${uri}`,
          };
          res.status(400).json(error);
          return;
        }
      } catch {
        const error: DCRError = {
          error: 'invalid_redirect_uri',
          error_description: `Invalid redirect URI format: ${uri}`,
        };
        res.status(400).json(error);
        return;
      }
    }

    // Validate grant_types if provided
    const allowedGrantTypes = ['authorization_code', 'refresh_token'];
    const grantTypes = body.grant_types || ['authorization_code'];
    for (const grantType of grantTypes) {
      if (!allowedGrantTypes.includes(grantType)) {
        const error: DCRError = {
          error: 'invalid_client_metadata',
          error_description: `Unsupported grant_type: ${grantType}`,
        };
        res.status(400).json(error);
        return;
      }
    }

    // Validate response_types if provided
    const allowedResponseTypes = ['code'];
    const responseTypes = body.response_types || ['code'];
    for (const responseType of responseTypes) {
      if (!allowedResponseTypes.includes(responseType)) {
        const error: DCRError = {
          error: 'invalid_client_metadata',
          error_description: `Unsupported response_type: ${responseType}`,
        };
        res.status(400).json(error);
        return;
      }
    }

    // Create the client
    const createRequest: CreateClientRequest = {
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      scope: body.scope,
    };

    const client = clientModel.create(createRequest);

    // Build response
    const response: DCRResponse = {
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_id_issued_at: client.created_at,
      client_secret_expires_at: 0, // 0 means the secret never expires
      client_name: client.client_name || undefined,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      scope: client.scope || undefined,
      token_endpoint_auth_method: 'client_secret_post',
    };

    console.log(`[DCR] Registered new client: ${client.client_id}`);

    res.status(201).json(response);
  } catch (error) {
    console.error('[DCR] Error registering client:', error);
    const errorResponse: DCRError = {
      error: 'server_error',
      error_description: 'An unexpected error occurred during client registration',
    };
    res.status(500).json(errorResponse);
  }
});

export { router as dcrRouter };
