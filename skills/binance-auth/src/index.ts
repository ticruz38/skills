/**
 * Binance Auth Skill
 * Binance API authentication and key management for trading skills
 * Built on top of auth-provider for secure credential storage
 */

import { 
  AuthProvider, 
  getAuthProvider, 
  ApiKeyData,
  BinanceMetadata,
  BinanceProviderAdapter
} from '@openclaw/auth-provider';

// Re-export auth provider for advanced users
export { AuthProvider, getAuthProvider };

/**
 * Binance API environments
 */
export type BinanceEnvironment = 'production' | 'testnet';

/**
 * Binance API permissions
 */
export type BinancePermission = 
  | 'SPOT' 
  | 'MARGIN' 
  | 'FUTURES' 
  | 'DELIVERY' 
  | 'PERM' 
  | 'IP_RESTRICTED';

/**
 * Credentials for Binance API
 */
export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  environment: BinanceEnvironment;
  permissions?: string[];
}

/**
 * Result of connecting to Binance API
 */
export interface BinanceConnectionResult {
  success: boolean;
  permissions?: string[];
  canTrade?: boolean;
  canWithdraw?: boolean;
  error?: string;
}

/**
 * Account balance information
 */
export interface BinanceBalance {
  totalBTC: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions: string[];
}

/**
 * Validation result for API key
 */
export interface BinanceValidationResult {
  valid: boolean;
  permissions: string[];
  canTrade: boolean;
  canWithdraw: boolean;
}

/**
 * Health check result
 */
export interface BinanceHealthResult {
  status: 'healthy' | 'unhealthy';
  message: string;
  profile: string;
}

/**
 * Connection options for Binance
 */
export interface BinanceConnectOptions {
  apiKey: string;
  apiSecret: string;
  environment?: BinanceEnvironment;
}

/**
 * Binance Auth Client for a specific profile
 */
export class BinanceAuthClient {
  private auth: AuthProvider;
  private profile: string;
  
  constructor(profile: string = 'default', auth?: AuthProvider) {
    this.auth = auth || getAuthProvider();
    this.profile = profile;
  }
  
  /**
   * Create a client for a specific profile (static factory)
   */
  static forProfile(profile: string = 'default', auth?: AuthProvider): BinanceAuthClient {
    return new BinanceAuthClient(profile, auth);
  }
  
  /**
   * Connect and store Binance API credentials
   */
  async connect(options: BinanceConnectOptions): Promise<BinanceConnectionResult> {
    try {
      const environment = options.environment || 'production';
      
      // Validate credentials format
      if (!this.isValidApiKey(options.apiKey)) {
        return {
          success: false,
          error: 'Invalid API key format. Binance API keys are 64 characters.',
        };
      }
      
      if (!this.isValidApiSecret(options.apiSecret)) {
        return {
          success: false,
          error: 'Invalid API secret format. Binance API secrets are 64 characters.',
        };
      }
      
      // Create temporary adapter to validate credentials
      const adapter = new BinanceProviderAdapter(
        options.apiKey,
        options.apiSecret,
        environment
      );
      
      // Validate the API key by fetching account info
      const validation = await adapter.validateApiKey();
      
      if (!validation.valid) {
        return {
          success: false,
          error: 'API key validation failed. Please check your credentials.',
        };
      }
      
      // Store the credentials
      const metadata: BinanceMetadata = {
        environment,
        permissions: validation.permissions,
      };
      
      await this.auth.saveApiKey(
        'binance',
        this.profile,
        options.apiKey,
        options.apiSecret,
        environment,
        validation.permissions,
        metadata
      );
      
      return {
        success: true,
        permissions: validation.permissions,
        canTrade: validation.canTrade,
        canWithdraw: validation.canWithdraw,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Check if this profile is connected (has stored credentials)
   */
  async isConnected(): Promise<boolean> {
    const credentials = await this.auth.getApiKey('binance', this.profile);
    return credentials !== undefined;
  }
  
  /**
   * Get stored credentials
   */
  async getCredentials(): Promise<{ apiKey: string; environment: BinanceEnvironment; permissions?: string[] } | null> {
    const credentials = await this.auth.getApiKey('binance', this.profile);
    
    if (!credentials) {
      return null;
    }
    
    // Return safe info (apiSecret is not exposed)
    return {
      apiKey: credentials.api_key,
      environment: credentials.environment as BinanceEnvironment,
      permissions: credentials.permissions,
    };
  }
  
  /**
   * Get full API key data (including secret) for making API calls
   * Use with caution - only for internal API calls
   */
  async getFullCredentials(): Promise<ApiKeyData | null> {
    const credentials = await this.auth.getApiKey('binance', this.profile);
    return credentials || null;
  }
  
  /**
   * Get the Binance provider adapter for making API calls
   */
  async getAdapter(): Promise<BinanceProviderAdapter | null> {
    const credentials = await this.auth.getApiKey('binance', this.profile);
    
    if (!credentials) {
      return null;
    }
    
    const adapter = new BinanceProviderAdapter(
      credentials.api_key,
      credentials.api_secret,
      credentials.environment as BinanceEnvironment
    );
    
    return adapter;
  }
  
  /**
   * Perform health check on this connection
   */
  async healthCheck(): Promise<BinanceHealthResult> {
    const result = await this.auth.healthCheck('binance', this.profile);
    return {
      status: result.status,
      message: result.message || '',
      profile: this.profile,
    };
  }
  
  /**
   * Get account balance
   */
  async getBalance(): Promise<BinanceBalance | null> {
    const adapter = await this.getAdapter();
    
    if (!adapter) {
      return null;
    }
    
    try {
      const accountInfo = await adapter.getAccountInfo();
      
      if (!accountInfo) {
        return null;
      }
      
      return {
        totalBTC: '0', // Calculated below
        balances: accountInfo.balances.filter((b: {free: string, locked: string}) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0),
        permissions: accountInfo.permissions,
      };
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }
  
  /**
   * Validate API key permissions
   */
  async validatePermissions(): Promise<BinanceValidationResult> {
    const adapter = await this.getAdapter();
    
    if (!adapter) {
      return {
        valid: false,
        permissions: [],
        canTrade: false,
        canWithdraw: false,
      };
    }
    
    return adapter.validateApiKey();
  }
  
  /**
   * Test connectivity to Binance API
   */
  async testConnectivity(): Promise<boolean> {
    const adapter = await this.getAdapter();
    
    if (!adapter) {
      return false;
    }
    
    return adapter.testConnectivity();
  }
  
  /**
   * Get the base URL for the current environment
   */
  async getBaseUrl(): Promise<string | null> {
    const adapter = await this.getAdapter();
    return adapter?.getBaseUrl() || null;
  }
  
  /**
   * Disconnect (delete stored credentials)
   */
  async disconnect(): Promise<boolean> {
    return this.auth.deleteCredentials('binance', this.profile);
  }
  
  /**
   * Validate API key format
   */
  private isValidApiKey(apiKey: string): boolean {
    // Binance API keys are 64 character hex strings
    return /^[a-fA-F0-9]{64}$/.test(apiKey);
  }
  
  /**
   * Validate API secret format
   */
  private isValidApiSecret(apiSecret: string): boolean {
    // Binance API secrets are 64 character hex strings
    return /^[a-fA-F0-9]{64}$/.test(apiSecret);
  }
}

// Singleton instance cache
const clientCache: Map<string, BinanceAuthClient> = new Map();

/**
 * Get Binance auth client for a profile (singleton pattern)
 */
export function getBinanceAuth(profile: string = 'default'): BinanceAuthClient {
  if (!clientCache.has(profile)) {
    clientCache.set(profile, new BinanceAuthClient(profile));
  }
  return clientCache.get(profile)!;
}

/**
 * Get all connected Binance profiles
 */
export async function getConnectedProfiles(auth?: AuthProvider): Promise<string[]> {
  const provider = auth || getAuthProvider();
  return provider.listProfiles('binance');
}

/**
 * Check if any Binance account is connected
 */
export async function hasAnyConnection(auth?: AuthProvider): Promise<boolean> {
  const provider = auth || getAuthProvider();
  const profiles = await provider.listProfiles('binance');
  return profiles.length > 0;
}

/**
 * Disconnect all Binance accounts
 */
export async function disconnectAll(auth?: AuthProvider): Promise<number> {
  const provider = auth || getAuthProvider();
  const profiles = await provider.listProfiles('binance');
  let count = 0;
  
  for (const profile of profiles) {
    if (await provider.deleteCredentials('binance', profile)) {
      count++;
      // Remove from cache
      clientCache.delete(profile);
    }
  }
  
  return count;
}

/**
 * Health check all Binance connections
 */
export async function healthCheckAll(auth?: AuthProvider): Promise<BinanceHealthResult[]> {
  const provider = auth || getAuthProvider();
  const results = await provider.healthCheckAll();
  
  return results
    .filter(r => r.provider === 'binance')
    .map(r => ({
      status: r.status,
      message: r.message || '',
      profile: r.profile,
    }));
}

// Default export
export default BinanceAuthClient;
