/**
 * Binance API Provider Adapter
 * Handles Binance API key authentication (not OAuth)
 */

import {
  ProviderType,
  ApiKeyData,
  HealthCheckResult,
} from '../types';

export interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions: string[];
}

export class BinanceProviderAdapter {
  readonly type: ProviderType = 'binance';
  
  private baseUrl: string;

  constructor(
    private apiKey?: string,
    private apiSecret?: string,
    private environment: 'production' | 'testnet' = 'production'
  ) {
    this.baseUrl = environment === 'production'
      ? 'https://api.binance.com'
      : 'https://testnet.binance.vision';
  }

  /**
   * Create signature for Binance API request
   */
  private createSignature(queryString: string): string {
    if (!this.apiSecret) {
      throw new Error('API secret not configured');
    }
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Set credentials for this instance
   */
  setCredentials(apiKey: string, apiSecret: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Set environment (production or testnet)
   */
  setEnvironment(environment: 'production' | 'testnet'): void {
    this.environment = environment;
    this.baseUrl = environment === 'production'
      ? 'https://api.binance.com'
      : 'https://testnet.binance.vision';
  }

  /**
   * Get account information from Binance
   */
  async getAccountInfo(): Promise<BinanceAccountInfo | null> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials not configured');
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = this.createSignature(queryString);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
          },
        }
      );

      if (response.ok) {
        return await response.json() as BinanceAccountInfo;
      }
      
      const error = await response.text();
      throw new Error(`Binance API error: ${error}`);
    } catch (error) {
      throw new Error(`Failed to get account info: ${error}`);
    }
  }

  /**
   * Test connectivity to Binance API
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/ping`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get server time from Binance
   */
  async getServerTime(): Promise<number | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/time`);
      if (response.ok) {
        const data = await response.json() as { serverTime: number };
        return data.serverTime;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate API key permissions
   */
  async validateApiKey(): Promise<{
    valid: boolean;
    permissions: string[];
    canTrade: boolean;
    canWithdraw: boolean;
  }> {
    try {
      const accountInfo = await this.getAccountInfo();
      
      if (!accountInfo) {
        return {
          valid: false,
          permissions: [],
          canTrade: false,
          canWithdraw: false,
        };
      }

      return {
        valid: true,
        permissions: accountInfo.permissions || [],
        canTrade: accountInfo.canTrade,
        canWithdraw: accountInfo.canWithdraw,
      };
    } catch {
      return {
        valid: false,
        permissions: [],
        canTrade: false,
        canWithdraw: false,
      };
    }
  }

  /**
   * Perform health check on Binance API key
   */
  async healthCheck(apiKeyData: ApiKeyData): Promise<HealthCheckResult> {
    try {
      this.setCredentials(apiKeyData.api_key, apiKeyData.api_secret);
      this.setEnvironment(apiKeyData.environment as 'production' | 'testnet');

      // First test connectivity
      const connected = await this.testConnectivity();
      if (!connected) {
        return {
          status: 'unhealthy',
          provider: this.type,
          profile: apiKeyData.profile,
          message: 'Cannot connect to Binance API',
        };
      }

      // Validate API key
      const validation = await this.validateApiKey();
      
      if (!validation.valid) {
        return {
          status: 'unhealthy',
          provider: this.type,
          profile: apiKeyData.profile,
          message: 'API key validation failed',
        };
      }

      return {
        status: 'healthy',
        provider: this.type,
        profile: apiKeyData.profile,
        message: `Permissions: ${validation.permissions.join(', ')}`,
        scopes: validation.permissions,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.type,
        profile: apiKeyData.profile,
        message: `Health check error: ${error}`,
      };
    }
  }

  /**
   * Get API endpoint URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Make authenticated request to Binance API
   */
  async request(endpoint: string, method: 'GET' | 'POST' = 'GET', params?: Record<string, any>): Promise<any> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials not configured');
    }

    const timestamp = Date.now();
    let queryString = `timestamp=${timestamp}`;
    
    if (params) {
      const paramString = new URLSearchParams(params).toString();
      if (paramString) {
        queryString += `&${paramString}`;
      }
    }
    
    const signature = this.createSignature(queryString);
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Binance API error: ${error}`);
    }

    return response.json();
  }
}
