/**
 * QuickBooks OAuth Provider Adapter
 * Handles QuickBooks Online OAuth 2.0 with PKCE
 */

import { BaseProviderAdapter } from './base';
import {
  ProviderType,
  OAuthState,
  TokenResponse,
  HealthCheckResult,
  TokenData,
} from '../types';

export interface QuickBooksCompanyInfo {
  companyName: string;
  legalName: string;
  companyAddr: {
    city: string;
    country: string;
    line1: string;
    postalCode: string;
    countrySubDivisionCode: string;
  };
  email: {
    address: string;
  };
  webAddr: {
    uri: string;
  };
  fiscalYearStartMonth: string;
  taxFormType: string;
  industryType: string;
  industryCode: string;
}

export class QuickBooksProviderAdapter extends BaseProviderAdapter {
  readonly type: ProviderType = 'quickbooks';
  
  private environment: 'production' | 'sandbox';
  private baseUrl: string;
  private sandboxBaseUrl: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string = 'http://localhost:8080/auth/callback',
    environment: 'production' | 'sandbox' = 'sandbox'
  ) {
    const isProduction = environment === 'production';
    
    super(
      clientId,
      clientSecret,
      redirectUri,
      isProduction
        ? 'https://appcenter.intuit.com/connect/oauth2'
        : 'https://appcenter.intuit.com/connect/oauth2',
      isProduction
        ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
        : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      [
        'com.intuit.quickbooks.accounting',
      ]
    );
    
    this.environment = environment;
    this.baseUrl = 'https://quickbooks.api.intuit.com/v3/company';
    this.sandboxBaseUrl = 'https://sandbox-quickbooks.api.intuit.com/v3/company';
  }

  /**
   * Get the appropriate base URL based on environment
   */
  private getApiBaseUrl(): string {
    return this.environment === 'production' ? this.baseUrl : this.sandboxBaseUrl;
  }

  /**
   * Generate authorization URL with PKCE
   */
  generateAuthUrl(profile: string, scopes?: string[], realmId?: string): any {
    const result = super.generateAuthUrl(profile, scopes);
    
    // Add realmId if provided (for re-authenticating existing company)
    if (realmId) {
      const url = new URL(result.url);
      url.searchParams.set('realmId', realmId);
      result.url = url.toString();
    }

    return result;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, state: OAuthState): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });

    // QuickBooks uses Basic auth for token endpoint
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
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
      scope: data.scope || 'com.intuit.quickbooks.accounting',
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
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
      scope: data.scope || 'com.intuit.quickbooks.accounting',
    };
  }

  /**
   * Get company info from QuickBooks
   */
  async getCompanyInfo(accessToken: string, realmId: string): Promise<QuickBooksCompanyInfo | null> {
    try {
      const baseUrl = this.getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { CompanyInfo: QuickBooksCompanyInfo };
        return data.CompanyInfo;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate token by making a test API call
   */
  async validateToken(accessToken: string, realmId: string): Promise<boolean> {
    try {
      const baseUrl = this.getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Perform health check on QuickBooks token
   */
  async healthCheck(tokenData: TokenData): Promise<HealthCheckResult> {
    try {
      const realmId = tokenData.metadata?.realmId;
      
      if (!realmId) {
        return {
          status: 'unhealthy',
          provider: this.type,
          profile: tokenData.profile,
          message: 'Realm ID not found in token metadata',
        };
      }

      const isValid = await this.validateToken(tokenData.access_token, realmId);
      
      if (!isValid) {
        return {
          status: 'unhealthy',
          provider: this.type,
          profile: tokenData.profile,
          message: 'Token validation failed',
        };
      }

      const isExpired = this.isTokenExpired(tokenData.expires_at || 0);

      return {
        status: isExpired ? 'unhealthy' : 'healthy',
        provider: this.type,
        profile: tokenData.profile,
        message: isExpired ? 'Token expiring soon' : `Realm: ${realmId}`,
        expires_at: tokenData.expires_at,
        scopes: tokenData.scope?.split(' ') || [],
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
   * Set environment (production or sandbox)
   */
  setEnvironment(environment: 'production' | 'sandbox'): void {
    this.environment = environment;
  }

  /**
   * Get current environment
   */
  getEnvironment(): string {
    return this.environment;
  }
}
