/**
 * Auth Provider - Main Entry Point
 * Centralized authentication management for OAuth and API key providers
 */

import {
  ProviderType,
  TokenData,
  ApiKeyData,
  OAuthState,
  AuthUrlResult,
  TokenResponse,
  HealthCheckResult,
  AuthProviderOptions,
  ProviderAdapter,
} from './types';
import { EncryptedStorage } from './storage';
import {
  GoogleProviderAdapter,
  BinanceProviderAdapter,
  QuickBooksProviderAdapter,
  SlackProviderAdapter,
} from './providers';

export * from './types';
export * from './storage';
export * from './providers';

export class AuthProvider {
  private storage: EncryptedStorage;
  private adapters: Map<ProviderType, ProviderAdapter> = new Map();
  private options: AuthProviderOptions;

  constructor(options: AuthProviderOptions = {}) {
    this.options = {
      tokenRefreshBuffer: 300, // 5 minutes before expiry
      ...options,
    };
    
    this.storage = new EncryptedStorage(options);
    this.initializeAdapters();
  }

  /**
   * Initialize provider adapters from environment variables
   */
  private initializeAdapters(): void {
    // Google OAuth
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (googleClientId && googleClientSecret) {
      this.registerAdapter(
        'google',
        new GoogleProviderAdapter(
          googleClientId,
          googleClientSecret,
          process.env.GOOGLE_REDIRECT_URI
        )
      );
    }

    // QuickBooks OAuth
    const qbClientId = process.env.QUICKBOOKS_CLIENT_ID;
    const qbClientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    if (qbClientId && qbClientSecret) {
      this.registerAdapter(
        'quickbooks',
        new QuickBooksProviderAdapter(
          qbClientId,
          qbClientSecret,
          process.env.QUICKBOOKS_REDIRECT_URI,
          (process.env.QUICKBOOKS_ENVIRONMENT as 'production' | 'sandbox') || 'sandbox'
        )
      );
    }

    // Slack OAuth
    const slackClientId = process.env.SLACK_CLIENT_ID;
    const slackClientSecret = process.env.SLACK_CLIENT_SECRET;
    if (slackClientId && slackClientSecret) {
      this.registerAdapter(
        'slack',
        new SlackProviderAdapter(
          slackClientId,
          slackClientSecret,
          process.env.SLACK_REDIRECT_URI
        )
      );
    }

    // Binance doesn't need OAuth adapter registration
    // It's handled separately via API keys
  }

  /**
   * Register a provider adapter
   */
  registerAdapter(provider: ProviderType, adapter: ProviderAdapter): void {
    this.adapters.set(provider, adapter);
  }

  /**
   * Get a provider adapter
   */
  getAdapter(provider: ProviderType): ProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * Check if a provider adapter is available
   */
  isProviderAvailable(provider: ProviderType): boolean {
    if (provider === 'binance') {
      // Binance uses API keys, no adapter needed
      return true;
    }
    return this.adapters.has(provider);
  }

  // ==================== OAuth Flow ====================

  /**
   * Start OAuth flow - generate authorization URL
   */
  initiateAuth(
    provider: ProviderType,
    profile: string = 'default',
    scopes?: string[]
  ): AuthUrlResult {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ${provider}`);
    }

    const result = adapter.generateAuthUrl(profile, scopes);

    // Get the full OAuth state from result (some adapters may return it)
    const oauthState: OAuthState = {
      state: result.state,
      provider,
      profile,
      scopes: scopes || [],
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: result.expiresAt,
    };

    // Store state for callback verification
    this.storage.saveOAuthState(oauthState);

    return result;
  }

  /**
   * Complete OAuth flow - exchange code for tokens
   */
  async completeAuth(
    provider: ProviderType,
    code: string,
    state: string,
    metadata?: Record<string, any>
  ): Promise<TokenData> {
    // Verify state
    const oauthState = await this.storage.getOAuthState(state);
    if (!oauthState) {
      throw new Error('Invalid or expired state parameter');
    }

    if (oauthState.provider !== provider) {
      throw new Error('Provider mismatch in state parameter');
    }

    // Clean up state
    await this.storage.deleteOAuthState(state);

    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ${provider}`);
    }

    // Exchange code for tokens
    const tokenResponse = await adapter.exchangeCode(code, oauthState);

    // Calculate expiration
    const expiresAt = tokenResponse.expires_in
      ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in
      : undefined;

    // Build token data
    const tokenData: TokenData = {
      provider,
      profile: oauthState.profile,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: expiresAt,
      scope: tokenResponse.scope,
      token_type: tokenResponse.token_type,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store encrypted token
    await this.storage.saveToken(tokenData);

    return tokenData;
  }

  // ==================== Token Management ====================

  /**
   * Get stored token for provider/profile
   */
  async getToken(provider: ProviderType, profile: string = 'default'): Promise<TokenData | undefined> {
    return await this.storage.getToken(provider, profile);
  }

  /**
   * Get valid access token (auto-refresh if needed)
   */
  async getValidAccessToken(
    provider: ProviderType,
    profile: string = 'default'
  ): Promise<string | undefined> {
    let token = await this.storage.getToken(provider, profile);
    
    if (!token) {
      return undefined;
    }

    // Check if token needs refresh
    if (token.expires_at && token.refresh_token) {
      const refreshThreshold = (this.options.tokenRefreshBuffer || 300);
      const needsRefresh = Math.floor(Date.now() / 1000) >= (token.expires_at - refreshThreshold);

      if (needsRefresh) {
        const adapter = this.adapters.get(provider);
        if (adapter) {
          try {
            const refreshed = await adapter.refreshToken(token.refresh_token);
            
            // Update token data
            token = {
              ...token,
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token || token.refresh_token,
              expires_at: refreshed.expires_in
                ? Math.floor(Date.now() / 1000) + refreshed.expires_in
                : token.expires_at,
              updated_at: new Date().toISOString(),
            };

            await this.storage.saveToken(token);
          } catch (error) {
            console.error(`Failed to refresh token for ${provider}/${profile}:`, error);
            return undefined;
          }
        }
      }
    }

    return token.access_token;
  }

  /**
   * Delete stored token
   */
  async deleteToken(provider: ProviderType, profile: string = 'default'): Promise<void> {
    await this.storage.deleteToken(provider, profile);
  }

  /**
   * List all stored tokens
   */
  async listTokens(provider?: ProviderType): Promise<TokenData[]> {
    return await this.storage.listTokens(provider);
  }

  /**
   * Check if token exists and is valid
   */
  async isAuthenticated(
    provider: ProviderType,
    profile: string = 'default'
  ): Promise<boolean> {
    const token = await this.storage.getToken(provider, profile);
    if (!token) return false;

    const adapter = this.adapters.get(provider);
    if (adapter?.validateToken) {
      return await adapter.validateToken(token.access_token);
    }

    // Fallback: check expiration
    if (token.expires_at) {
      return Math.floor(Date.now() / 1000) < token.expires_at;
    }

    return true;
  }

  // ==================== API Key Management ====================

  /**
   * Store API key credentials
   */
  async saveApiKey(
    provider: ProviderType,
    profile: string,
    apiKey: string,
    apiSecret: string,
    environment: 'production' | 'sandbox' | 'testnet' = 'production',
    permissions?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const apiKeyData: ApiKeyData = {
      provider,
      profile,
      api_key: apiKey,
      api_secret: apiSecret,
      environment,
      permissions,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.storage.saveApiKey(apiKeyData);
  }

  /**
   * Get stored API key
   */
  async getApiKey(provider: ProviderType, profile: string = 'default'): Promise<ApiKeyData | undefined> {
    return await this.storage.getApiKey(provider, profile);
  }

  /**
   * Delete stored API key
   */
  async deleteApiKey(provider: ProviderType, profile: string = 'default'): Promise<void> {
    await this.storage.deleteApiKey(provider, profile);
  }

  /**
   * List all stored API keys
   */
  async listApiKeys(provider?: ProviderType): Promise<ApiKeyData[]> {
    return await this.storage.listApiKeys(provider);
  }

  // ==================== Health Checks ====================

  /**
   * Perform health check on provider credentials
   */
  async healthCheck(
    provider: ProviderType,
    profile: string = 'default'
  ): Promise<HealthCheckResult> {
    // For OAuth providers
    const token = await this.storage.getToken(provider, profile);
    if (token) {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        return await adapter.healthCheck(token);
      }
    }

    // For API key providers (Binance)
    if (provider === 'binance') {
      const apiKey = await this.storage.getApiKey(provider, profile);
      if (apiKey) {
        const binanceAdapter = new BinanceProviderAdapter();
        return await binanceAdapter.healthCheck(apiKey);
      }
    }

    return {
      status: 'unhealthy',
      provider,
      profile,
      message: 'No credentials found',
    };
  }

  /**
   * Perform health check on all stored credentials
   */
  async healthCheckAll(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    // Check all tokens
    const tokens = await this.storage.listTokens();
    for (const token of tokens) {
      results.push(await this.healthCheck(token.provider, token.profile));
    }

    // Check all API keys
    const apiKeys = await this.storage.listApiKeys();
    for (const apiKey of apiKeys) {
      results.push(await this.healthCheck(apiKey.provider, apiKey.profile));
    }

    return results;
  }

  // ==================== Utility ====================

  /**
   * Cleanup expired OAuth states
   */
  async cleanup(): Promise<void> {
    await this.storage.cleanupExpiredStates();
  }

  /**
   * Close storage connection
   */
  close(): void {
    this.storage.close();
  }

  /**
   * Get Binance API client
   */
  async getBinanceClient(
    profile: string = 'default'
  ): Promise<BinanceProviderAdapter | undefined> {
    const apiKey = await this.storage.getApiKey('binance', profile);
    if (!apiKey) return undefined;

    return new BinanceProviderAdapter(
      apiKey.api_key,
      apiKey.api_secret,
      apiKey.environment as 'production' | 'testnet'
    );
  }

  /**
   * Get provider-specific client
   */
  async getClient<T>(
    provider: ProviderType,
    profile: string = 'default'
  ): Promise<T | undefined> {
    // For OAuth providers, return adapter with valid token
    const token = await this.getValidAccessToken(provider, profile);
    if (token) {
      const adapter = this.adapters.get(provider);
      return adapter as T;
    }

    // For API key providers
    if (provider === 'binance') {
      return this.getBinanceClient(profile) as Promise<T>;
    }

    return undefined;
  }
}

// Create singleton instance
let defaultProvider: AuthProvider | null = null;

/**
 * Get default auth provider instance
 */
export function getAuthProvider(options?: AuthProviderOptions): AuthProvider {
  if (!defaultProvider) {
    defaultProvider = new AuthProvider(options);
  }
  return defaultProvider;
}

/**
 * Reset default provider (useful for testing)
 */
export function resetAuthProvider(): void {
  defaultProvider?.close();
  defaultProvider = null;
}
