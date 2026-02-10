/**
 * Base Provider Adapter
 * Common functionality for all provider adapters
 */

import {
  ProviderAdapter,
  ProviderType,
  PKCEChallenge,
  OAuthState,
  AuthUrlResult,
  TokenResponse,
} from '../types';
import * as crypto from 'crypto';

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly type: ProviderType;
  
  protected clientId: string;
  protected clientSecret: string;
  protected redirectUri: string;
  protected authUrl: string;
  protected tokenUrl: string;
  protected defaultScopes: string[];

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    authUrl: string,
    tokenUrl: string,
    defaultScopes: string[]
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.authUrl = authUrl;
    this.tokenUrl = tokenUrl;
    this.defaultScopes = defaultScopes;
  }

  /**
   * Generate PKCE challenge pair for secure OAuth flow
   */
  protected generatePKCE(): PKCEChallenge {
    const codeVerifier = this.base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = this.base64URLEncode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  protected generateState(): string {
    return this.base64URLEncode(crypto.randomBytes(32));
  }

  /**
   * Base64URL encode a buffer
   */
  protected base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate authorization URL with PKCE
   */
  generateAuthUrl(profile: string, scopes?: string[]): AuthUrlResult {
    const pkce = this.generatePKCE();
    const state = this.generateState();
    const requestedScopes = scopes || this.defaultScopes;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: requestedScopes.join(' '),
      state: state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
    });

    // Build OAuth state object
    const oauthState: OAuthState = {
      state,
      provider: this.type,
      profile,
      pkce,
      scopes: requestedScopes,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    };

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state,
      expiresAt: oauthState.expiresAt,
    };
  }

  /**
   * Exchange authorization code for tokens
   * Must be implemented by each provider
   */
  abstract exchangeCode(code: string, state: OAuthState): Promise<TokenResponse>;

  /**
   * Refresh an access token
   * Must be implemented by each provider
   */
  abstract refreshToken(refreshToken: string): Promise<TokenResponse>;

  /**
   * Check if token is expired or about to expire
   */
  protected isTokenExpired(expiresAt: number, bufferSeconds: number = 300): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= (expiresAt - bufferSeconds);
  }

  /**
   * Perform health check on token
   * Default implementation - providers can override
   */
  async healthCheck(tokenData: any): Promise<any> {
    const isExpired = tokenData.expires_at 
      ? this.isTokenExpired(tokenData.expires_at)
      : false;

    return {
      status: isExpired ? 'unhealthy' : 'healthy',
      provider: this.type,
      profile: tokenData.profile,
      expires_at: tokenData.expires_at,
      scopes: tokenData.scope?.split(' ') || [],
    };
  }
}
