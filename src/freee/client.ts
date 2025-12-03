import { config } from '../config/env';
import { tokenModel, Token } from '../db/models/token';
import { refreshAccessToken } from './auth';

export interface FreeeApiError {
  status_code: number;
  errors: Array<{
    type: string;
    messages: string[];
  }>;
}

/**
 * freee API Client
 * Handles API calls to freee with automatic token refresh
 */
export class FreeeClient {
  private token: Token;

  constructor(token: Token) {
    this.token = token;
  }

  /**
   * Make an authenticated request to freee API
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    // Check if freee token needs refresh
    await this.ensureValidToken();

    const url = new URL(path, config.freee.apiBaseUrl);

    // Add query parameters
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token.freee_access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ status_code: response.status, errors: [] }));
      throw new FreeeApiException(response.status, error as FreeeApiError);
    }

    // Handle empty responses (e.g., DELETE)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Ensure the freee access token is valid, refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Check if token expires in the next 5 minutes
    if (this.token.freee_token_expires_at && this.token.freee_token_expires_at > now + 300) {
      return; // Token is still valid
    }

    // Token needs refresh
    if (!this.token.freee_refresh_token) {
      throw new Error('Cannot refresh freee token: no refresh token available');
    }

    console.log(`[FreeeClient] Refreshing expired freee token for token: ${this.token.id}`);

    const newTokens = await refreshAccessToken(this.token.freee_refresh_token);

    // Update token in database
    tokenModel.updateFreeeTokens(
      this.token.id,
      newTokens.access_token,
      newTokens.refresh_token,
      newTokens.created_at + newTokens.expires_in
    );

    // Update local token object
    this.token.freee_access_token = newTokens.access_token;
    this.token.freee_refresh_token = newTokens.refresh_token;
    this.token.freee_token_expires_at = newTokens.created_at + newTokens.expires_in;
  }

  // Convenience methods
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('POST', path, body, params);
  }

  put<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('PUT', path, body, params);
  }

  delete<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('DELETE', path, undefined, params);
  }
}

export class FreeeApiException extends Error {
  status: number;
  apiError: FreeeApiError;

  constructor(status: number, error: FreeeApiError) {
    const messages = error.errors?.flatMap(e => e.messages).join(', ') || 'Unknown error';
    super(`freee API error (${status}): ${messages}`);
    this.status = status;
    this.apiError = error;
  }
}
