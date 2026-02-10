/**
 * Google OAuth Provider Adapter
 * Handles Google OAuth 2.0 with PKCE
 */

import { BaseProviderAdapter } from './base';
import {
  ProviderType,
  OAuthState,
  TokenResponse,
  HealthCheckResult,
  TokenData,
} from '../types';

export interface GoogleTokenInfo {
  issued_to: string;
  audience: string;
  user_id?: string;
  scope: string;
  expires_in: number;
  email?: string;
  verified_email?: boolean;
  access_type: string;
}

export class GoogleProviderAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'google';

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string = 'http://localhost:8080/auth/callback'
  ) {
    super(
      clientId,
      clientSecret,
      redirectUri,
      'https://accounts.google.com/o/oauth2/v2/auth',
      'https://oauth2.googleapis.com/token',
      [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive',
      ]
    );
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, state: OAuthState): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    if (state.pkce?.codeVerifier) {
      params.append('code_verifier', state.pkce.codeVerifier);
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
      scope?: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
      scope?: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Validate token by calling Google tokeninfo endpoint
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get token info from Google
   */
  async getTokenInfo(token: string): Promise<GoogleTokenInfo | null> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`
      );
      if (response.ok) {
        return await response.json() as GoogleTokenInfo;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get user profile info
   */
  async getUserProfile(token: string): Promise<{ email: string; name?: string; picture?: string } | null> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        return await response.json() as { email: string; name?: string; picture?: string };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Perform health check on Google token
   */
  async healthCheck(tokenData: TokenData): Promise<HealthCheckResult> {
    try {
      const tokenInfo = await this.getTokenInfo(tokenData.access_token);
      
      if (!tokenInfo) {
        return {
          status: 'unhealthy',
          provider: this.type,
          profile: tokenData.profile,
          message: 'Token validation failed',
        };
      }

      // Check if token is expired or about to expire
      const isExpiringSoon = tokenInfo.expires_in < 300; // Less than 5 minutes

      return {
        status: isExpiringSoon ? 'unhealthy' : 'healthy',
        provider: this.type,
        profile: tokenData.profile,
        message: isExpiringSoon ? 'Token expiring soon' : undefined,
        expires_at: Math.floor(Date.now() / 1000) + tokenInfo.expires_in,
        scopes: tokenInfo.scope?.split(' ') || [],
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.type,
        profile: tokenData.profile,
        message: `Health check error: ${error}`,
      };
    }
  }
}
