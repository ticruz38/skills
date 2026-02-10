/**
 * Google OAuth Skill
 * Simplified Google OAuth interface built on top of auth-provider
 * Provides easy access to Gmail, Calendar, Drive, and other Google services
 */

import { AuthProvider, getAuthProvider, TokenData } from '@openclaw/auth-provider';

// Re-export auth provider for advanced users
export { AuthProvider, getAuthProvider };

/**
 * Google Services supported by this skill
 */
export type GoogleService = 
  | 'gmail' 
  | 'calendar' 
  | 'drive' 
  | 'sheets' 
  | 'docs' 
  | 'people' 
  | 'all';

/**
 * OAuth scopes for each Google service
 */
export const GoogleScopes = {
  /** Gmail - Read, send, manage emails */
  GMAIL: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels',
  ],
  /** Gmail read-only */
  GMAIL_READONLY: ['https://www.googleapis.com/auth/gmail.readonly'],
  /** Gmail send only */
  GMAIL_SEND: ['https://www.googleapis.com/auth/gmail.send'],
  
  /** Calendar - Create events, check availability */
  CALENDAR: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  /** Calendar read-only */
  CALENDAR_READONLY: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ],
  
  /** Drive - Upload, download, manage files */
  DRIVE: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
  ],
  /** Drive read-only */
  DRIVE_READONLY: ['https://www.googleapis.com/auth/drive.readonly'],
  
  /** Sheets - Read/write spreadsheets */
  SHEETS: ['https://www.googleapis.com/auth/spreadsheets'],
  /** Sheets read-only */
  SHEETS_READONLY: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  
  /** Docs - Create and edit documents */
  DOCS: ['https://www.googleapis.com/auth/documents'],
  /** Docs read-only */
  DOCS_READONLY: ['https://www.googleapis.com/auth/documents.readonly'],
  
  /** People - User profile info */
  PEOPLE: [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ],
  
  /** All services combined */
  get ALL(): string[] {
    return [
      ...this.GMAIL,
      ...this.CALENDAR,
      ...this.DRIVE,
      ...this.SHEETS,
      ...this.DOCS,
      ...this.PEOPLE,
    ];
  },
  
  /** All read-only access */
  get READONLY(): string[] {
    return [
      ...this.GMAIL_READONLY,
      ...this.CALENDAR_READONLY,
      ...this.DRIVE_READONLY,
    ];
  },
} as const;

/**
 * Get scopes for a specific service or list of services
 */
export function getScopesForServices(services: GoogleService[]): string[] {
  if (services.includes('all')) {
    return GoogleScopes.ALL;
  }
  
  const scopes = new Set<string>();
  
  // Always include people for user identification
  GoogleScopes.PEOPLE.forEach(s => scopes.add(s));
  
  services.forEach(service => {
    switch (service) {
      case 'gmail':
        GoogleScopes.GMAIL.forEach(s => scopes.add(s));
        break;
      case 'calendar':
        GoogleScopes.CALENDAR.forEach(s => scopes.add(s));
        break;
      case 'drive':
        GoogleScopes.DRIVE.forEach(s => scopes.add(s));
        break;
      case 'sheets':
        GoogleScopes.SHEETS.forEach(s => scopes.add(s));
        break;
      case 'docs':
        GoogleScopes.DOCS.forEach(s => scopes.add(s));
        break;
    }
  });
  
  return Array.from(scopes);
}

/**
 * Result of Google OAuth authentication
 */
export interface GoogleAuthResult {
  success: boolean;
  email?: string;
  name?: string;
  picture?: string;
  scopes?: string[];
  expiresAt?: number;
  error?: string;
}

/**
 * Google OAuth client for a specific profile
 */
export class GoogleOAuthClient {
  private auth: AuthProvider;
  private profile: string;
  
  constructor(profile: string = 'default', auth?: AuthProvider) {
    this.auth = auth || getAuthProvider();
    this.profile = profile;
  }
  
  /**
   * Create a client for a specific profile (static factory)
   */
  static forProfile(profile: string = 'default', auth?: AuthProvider): GoogleOAuthClient {
    return new GoogleOAuthClient(profile, auth);
  }
  
  /**
   * Initiate OAuth flow and return authorization URL
   */
  initiateAuth(services: GoogleService[] = ['gmail', 'calendar', 'drive']): {
    url: string;
    state: string;
    scopes: string[];
  } {
    const scopes = getScopesForServices(services);
    const result = this.auth.initiateAuth('google', this.profile, scopes);
    
    return {
      url: result.url,
      state: result.state,
      scopes,
    };
  }
  
  /**
   * Complete OAuth flow with authorization code
   */
  async completeAuth(code: string, state: string): Promise<GoogleAuthResult> {
    try {
      const tokenData = await this.auth.completeAuth('google', code, state);
      
      // Get user profile info
      const adapter = this.auth.getAdapter('google');
      const profile = adapter?.getUserProfile 
        ? await adapter.getUserProfile(tokenData.access_token)
        : null;
      
      return {
        success: true,
        email: profile?.email || tokenData.metadata?.email,
        name: profile?.name,
        picture: profile?.picture,
        scopes: tokenData.scope?.split(' '),
        expiresAt: tokenData.expires_at,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Check if this profile is connected (has valid tokens)
   */
  isConnected(): boolean {
    const token = this.auth.getToken('google', this.profile);
    return token !== null;
  }
  
  /**
   * Get a valid access token (auto-refreshes if needed)
   */
  async getAccessToken(): Promise<string | null> {
    const token = await this.auth.getValidAccessToken('google', this.profile);
    return token || null;
  }
  
  /**
   * Get stored token data
   */
  async getTokenData(): Promise<TokenData | null> {
    const token = await this.auth.getToken('google', this.profile);
    return token || null;
  }
  
  /**
   * Get connected user's email
   */
  async getUserEmail(): Promise<string | null> {
    const profile = await this.auth.getUserProfile('google', this.profile);
    return profile?.email || null;
  }
  
  /**
   * Get connected user's full profile
   */
  async getUserProfile(): Promise<{ email: string; name?: string; picture?: string } | null> {
    return await this.auth.getUserProfile('google', this.profile);
  }
  
  /**
   * Get connected scopes
   */
  async getConnectedScopes(): Promise<string[]> {
    const token = await this.getTokenData();
    return token?.scope?.split(' ') || [];
  }
  
  /**
   * Check if specific service is authorized
   */
  async hasService(service: GoogleService): Promise<boolean> {
    if (service === 'all') return true;
    
    const scopes = await this.getConnectedScopes();
    const requiredScopes = getScopesForServices([service]);
    
    // Check if at least one scope from the service is present
    return requiredScopes.some(scope => scopes.includes(scope));
  }
  
  /**
   * Perform health check on this connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    expiresAt?: number;
  }> {
    const result = await this.auth.healthCheck('google', this.profile);
    return {
      status: result.status,
      message: result.message,
      expiresAt: result.expires_at,
    };
  }
  
  /**
   * Disconnect (delete stored tokens)
   */
  async disconnect(): Promise<boolean> {
    return this.auth.deleteCredentials('google', this.profile);
  }
  
  /**
   * Make an authenticated request to Google API
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please connect your Google account first.');
    }
    
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    
    return fetch(url, {
      ...options,
      headers,
    });
  }
}

/**
 * Get all connected Google profiles
 */
export async function getConnectedProfiles(auth?: AuthProvider): Promise<string[]> {
  const provider = auth || getAuthProvider();
  return provider.listProfiles('google');
}

/**
 * Check if any Google account is connected
 */
export async function hasAnyConnection(auth?: AuthProvider): Promise<boolean> {
  const profiles = await getConnectedProfiles(auth);
  return profiles.length > 0;
}

/**
 * Disconnect all Google accounts
 */
export async function disconnectAll(auth?: AuthProvider): Promise<number> {
  const provider = auth || getAuthProvider();
  const profiles = await getConnectedProfiles(provider);
  let count = 0;
  
  for (const profile of profiles) {
    if (await provider.deleteCredentials('google', profile)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Health check all Google connections
 */
export async function healthCheckAll(auth?: AuthProvider): Promise<
  Array<{
    profile: string;
    status: 'healthy' | 'unhealthy';
    message?: string;
    expiresAt?: number;
  }>
> {
  const provider = auth || getAuthProvider();
  const results = await provider.healthCheckAll();
  
  return results
    .filter(r => r.provider === 'google')
    .map(r => ({
      profile: r.profile,
      status: r.status,
      message: r.message,
      expiresAt: r.expires_at,
    }));
}

// Default export
export default GoogleOAuthClient;
