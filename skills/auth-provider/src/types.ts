/**
 * Auth Provider Types
 * Core type definitions for the auth-provider skill
 */

/** Supported OAuth providers */
export type ProviderType = 'google' | 'binance' | 'quickbooks' | 'slack';

/** Token data stored in database */
export interface TokenData {
  id?: number;
  provider: ProviderType;
  profile: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
  token_type?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/** API key credentials (for non-OAuth providers like Binance) */
export interface ApiKeyData {
  id?: number;
  provider: ProviderType;
  profile: string;
  api_key: string;
  api_secret: string;
  environment: 'production' | 'sandbox' | 'testnet';
  permissions?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/** OAuth configuration for a provider */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string;
}

/** API key configuration */
export interface ApiKeyConfig {
  apiKey: string;
  apiSecret: string;
  environment?: 'production' | 'sandbox' | 'testnet';
}

/** PKCE challenge pair */
export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/** OAuth flow state */
export interface OAuthState {
  state: string;
  provider: ProviderType;
  profile: string;
  pkce?: PKCEChallenge;
  scopes: string[];
  createdAt: number;
  expiresAt: number;
}

/** Health check result */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  provider: ProviderType;
  profile: string;
  message?: string;
  expires_at?: number;
  scopes?: string[];
}

/** Authorization URL result */
export interface AuthUrlResult {
  url: string;
  state: string;
  expiresAt: number;
}

/** Token response from OAuth provider */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

/** Provider adapter interface */
export interface ProviderAdapter {
  readonly type: ProviderType;
  generateAuthUrl(profile: string, scopes?: string[]): AuthUrlResult;
  exchangeCode(code: string, state: OAuthState): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  validateToken?(token: string, ...args: any[]): Promise<boolean>;
  healthCheck(tokenData: TokenData): Promise<HealthCheckResult>;
}

/** Storage interface for credentials */
export interface CredentialStorage {
  saveToken(token: TokenData): Promise<void> | void;
  getToken(provider: ProviderType, profile: string): Promise<TokenData | undefined> | TokenData | undefined;
  deleteToken(provider: ProviderType, profile: string): Promise<void> | void;
  listTokens(provider?: ProviderType): Promise<TokenData[]> | TokenData[];
  
  saveApiKey(apiKey: ApiKeyData): Promise<void> | void;
  getApiKey(provider: ProviderType, profile: string): Promise<ApiKeyData | undefined> | ApiKeyData | undefined;
  deleteApiKey(provider: ProviderType, profile: string): Promise<void> | void;
  listApiKeys(provider?: ProviderType): Promise<ApiKeyData[]> | ApiKeyData[];
  
  saveOAuthState(state: OAuthState): Promise<void> | void;
  getOAuthState(state: string): Promise<OAuthState | undefined> | OAuthState | undefined;
  deleteOAuthState(state: string): Promise<void> | void;
  cleanupExpiredStates(): Promise<void> | void;
}

/** Auth provider options */
export interface AuthProviderOptions {
  encryptionKey?: string;
  dbPath?: string;
  tokenRefreshBuffer?: number; // seconds before expiry to refresh
}

/** Binance-specific metadata */
export interface BinanceMetadata {
  environment: 'production' | 'testnet';
  permissions: string[];
}

/** QuickBooks-specific metadata */
export interface QuickBooksMetadata {
  realmId: string;
  environment: 'production' | 'sandbox';
}

/** Google-specific metadata */
export interface GoogleMetadata {
  email?: string;
  name?: string;
  picture?: string;
}

/** Slack-specific metadata */
export interface SlackMetadata {
  team?: string;
  teamId?: string;
  user?: string;
  userId?: string;
}
