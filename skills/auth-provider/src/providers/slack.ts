/**
 * Slack OAuth Provider Adapter
 * Handles Slack OAuth 2.0 with PKCE
 */

import { BaseProviderAdapter } from './base';
import {
  ProviderType,
  OAuthState,
  TokenResponse,
  HealthCheckResult,
  TokenData,
} from '../types';

export interface SlackAuthTestResponse {
  ok: boolean;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  error?: string;
}

export interface SlackTeamInfo {
  ok: boolean;
  team?: {
    id: string;
    name: string;
    domain: string;
    email_domain?: string;
    icon?: {
      image_132?: string;
    };
  };
  error?: string;
}

export class SlackProviderAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'slack';

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string = 'http://localhost:8080/auth/callback'
  ) {
    super(
      clientId,
      clientSecret,
      redirectUri,
      'https://slack.com/oauth/v2/authorize',
      'https://slack.com/api/oauth.v2.access',
      [
        'chat:write',
        'chat:write.public',
        'users:read',
        'team:read',
        'files:write',
        'channels:read',
        'groups:read',
        'im:read',
        'mpim:read',
      ]
    );
  }

  /**
   * Generate authorization URL with PKCE
   * Slack OAuth v2 uses user_scope for bot tokens
   */
  generateAuthUrl(profile: string, scopes?: string[]): any {
    const pkce = this.generatePKCE();
    const state = this.generateState();
    const requestedScopes = scopes || this.defaultScopes;

    // Slack OAuth v2 parameters
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: requestedScopes.join(','), // Slack uses comma separator
      state: state,
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
      oauthState, // Return for storage
    };
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
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      ok: boolean;
      error?: string;
      access_token?: string;
      authed_user?: { access_token?: string };
      token_type?: string;
      scope?: string;
    };

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    // Slack returns bot token and user token separately
    const botToken = data.access_token;
    const userToken = data.authed_user?.access_token;

    return {
      access_token: botToken || userToken || '',
      refresh_token: undefined, // Slack tokens don't expire, no refresh needed
      expires_in: undefined,    // No expiration
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /**
   * Slack tokens don't expire, so refresh is a no-op
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Slack tokens don't expire, return the same token
    return {
      access_token: refreshToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
    };
  }

  /**
   * Test authentication with Slack
   */
  async authTest(token: string): Promise<SlackAuthTestResponse> {
    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.ok) {
        return await response.json() as SlackAuthTestResponse;
      }
      
      return { ok: false, error: 'HTTP error' };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Get team info from Slack
   */
  async getTeamInfo(token: string): Promise<SlackTeamInfo | null> {
    try {
      const response = await fetch('https://slack.com/api/team.info', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.ok) {
        return await response.json() as SlackTeamInfo;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate token by calling auth.test
   */
  async validateToken(token: string): Promise<boolean> {
    const result = await this.authTest(token);
    return result.ok;
  }

  /**
   * Perform health check on Slack token
   */
  async healthCheck(tokenData: TokenData): Promise<HealthCheckResult> {
    try {
      const authResult = await this.authTest(tokenData.access_token);
      
      if (!authResult.ok) {
        return {
          status: 'unhealthy',
          provider: this.type,
          profile: tokenData.profile,
          message: `Slack auth error: ${authResult.error}`,
        };
      }

      return {
        status: 'healthy',
        provider: this.type,
        profile: tokenData.profile,
        message: `Team: ${authResult.team}, User: ${authResult.user}`,
        scopes: tokenData.scope?.split(',') || [],
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

  /**
   * Send a message to a Slack channel
   */
  async sendMessage(token: string, channel: string, text: string): Promise<any> {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${await response.text()}`);
    }

    return response.json();
  }

  /**
   * Get list of channels
   */
  async listChannels(token: string, types: string = 'public_channel,private_channel'): Promise<any> {
    const params = new URLSearchParams({
      types,
      limit: '100',
    });

    const response = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list channels: ${await response.text()}`);
    }

    return response.json();
  }
}
