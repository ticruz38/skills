/**
 * Encrypted SQLite Storage
 * Handles secure storage of OAuth tokens and API keys
 */

import sqlite3 from 'sqlite3';
import CryptoJS from 'crypto-js';
import { join } from 'path';
import { homedir } from 'os';
import {
  TokenData,
  ApiKeyData,
  OAuthState,
  CredentialStorage,
  AuthProviderOptions,
  ProviderType,
} from './types';

// Promisify database operations
function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function get<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function all<T>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export class EncryptedStorage implements CredentialStorage {
  private db: sqlite3.Database;
  private encryptionKey: string;
  private initPromise: Promise<void>;
  private isClosed = false;

  constructor(options: AuthProviderOptions = {}) {
    // Use provided encryption key or generate from env/hostname
    this.encryptionKey = options.encryptionKey || this.getDefaultEncryptionKey();
    
    // Setup database path
    const dbPath = options.dbPath || join(
      homedir(),
      '.openclaw',
      'skills',
      'auth-provider',
      'credentials.db'
    );
    
    // Ensure directory exists
    const fs = require('fs');
    const dir = require('path').dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    
    this.db = new sqlite3.Database(dbPath);
    this.initPromise = this.initializeSchema();
  }

  private getDefaultEncryptionKey(): string {
    // Use environment variable or machine-specific value
    return process.env.AUTH_PROVIDER_KEY || 
           process.env.OPENCLAW_ENCRYPTION_KEY ||
           require('crypto').randomBytes(32).toString('hex');
  }

  private initializeSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Enable WAL mode and foreign keys
        this.db.run('PRAGMA journal_mode = WAL');
        this.db.run('PRAGMA foreign_keys = ON');

        // Tokens table for OAuth credentials
        this.db.run(`
          CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            profile TEXT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            expires_at INTEGER,
            scope TEXT,
            token_type TEXT DEFAULT 'Bearer',
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(provider, profile)
          )
        `);

        // API keys table for non-OAuth providers
        this.db.run(`
          CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            profile TEXT NOT NULL,
            api_key TEXT NOT NULL,
            api_secret TEXT NOT NULL,
            environment TEXT DEFAULT 'production',
            permissions TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(provider, profile)
          )
        `);

        // OAuth state table for PKCE flows
        this.db.run(`
          CREATE TABLE IF NOT EXISTS oauth_states (
            state TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            profile TEXT NOT NULL,
            pkce_code_verifier TEXT,
            scopes TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          )
        `);

        // Create indexes
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_provider ON tokens(provider)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_profile ON tokens(provider, profile)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  private decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isClosed) {
      throw new Error('Database connection is closed');
    }
    await this.initPromise;
  }

  // Token operations
  async saveToken(token: TokenData): Promise<void> {
    await this.ensureInitialized();
    
    await run(this.db, `
      INSERT INTO tokens (provider, profile, access_token, refresh_token, expires_at, scope, token_type, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider, profile) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        token_type = excluded.token_type,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `, [
      token.provider,
      token.profile,
      this.encrypt(token.access_token),
      token.refresh_token ? this.encrypt(token.refresh_token) : null,
      token.expires_at || null,
      token.scope || null,
      token.token_type || 'Bearer',
      token.metadata ? JSON.stringify(token.metadata) : null,
    ]);
  }

  async getToken(provider: ProviderType, profile: string): Promise<TokenData | undefined> {
    await this.ensureInitialized();
    
    const row = await get<any>(this.db,
      'SELECT * FROM tokens WHERE provider = ? AND profile = ?',
      [provider, profile]
    );

    if (!row) return undefined;

    return {
      id: row.id,
      provider: row.provider,
      profile: row.profile,
      access_token: this.decrypt(row.access_token),
      refresh_token: row.refresh_token ? this.decrypt(row.refresh_token) : undefined,
      expires_at: row.expires_at,
      scope: row.scope,
      token_type: row.token_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteToken(provider: ProviderType, profile: string): Promise<void> {
    await this.ensureInitialized();
    await run(this.db,
      'DELETE FROM tokens WHERE provider = ? AND profile = ?',
      [provider, profile]
    );
  }

  async listTokens(provider?: ProviderType): Promise<TokenData[]> {
    await this.ensureInitialized();
    
    let sql = 'SELECT * FROM tokens';
    let rows: any[];

    if (provider) {
      rows = await all<any>(this.db, sql + ' WHERE provider = ?', [provider]);
    } else {
      rows = await all<any>(this.db, sql);
    }

    return rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      profile: row.profile,
      access_token: this.decrypt(row.access_token),
      refresh_token: row.refresh_token ? this.decrypt(row.refresh_token) : undefined,
      expires_at: row.expires_at,
      scope: row.scope,
      token_type: row.token_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  // API Key operations
  async saveApiKey(apiKey: ApiKeyData): Promise<void> {
    await this.ensureInitialized();
    
    await run(this.db, `
      INSERT INTO api_keys (provider, profile, api_key, api_secret, environment, permissions, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider, profile) DO UPDATE SET
        api_key = excluded.api_key,
        api_secret = excluded.api_secret,
        environment = excluded.environment,
        permissions = excluded.permissions,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `, [
      apiKey.provider,
      apiKey.profile,
      this.encrypt(apiKey.api_key),
      this.encrypt(apiKey.api_secret),
      apiKey.environment,
      apiKey.permissions ? JSON.stringify(apiKey.permissions) : null,
      apiKey.metadata ? JSON.stringify(apiKey.metadata) : null,
    ]);
  }

  async getApiKey(provider: ProviderType, profile: string): Promise<ApiKeyData | undefined> {
    await this.ensureInitialized();
    
    const row = await get<any>(this.db,
      'SELECT * FROM api_keys WHERE provider = ? AND profile = ?',
      [provider, profile]
    );

    if (!row) return undefined;

    return {
      id: row.id,
      provider: row.provider,
      profile: row.profile,
      api_key: this.decrypt(row.api_key),
      api_secret: this.decrypt(row.api_secret),
      environment: row.environment,
      permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteApiKey(provider: ProviderType, profile: string): Promise<void> {
    await this.ensureInitialized();
    await run(this.db,
      'DELETE FROM api_keys WHERE provider = ? AND profile = ?',
      [provider, profile]
    );
  }

  async listApiKeys(provider?: ProviderType): Promise<ApiKeyData[]> {
    await this.ensureInitialized();
    
    let sql = 'SELECT * FROM api_keys';
    let rows: any[];

    if (provider) {
      rows = await all<any>(this.db, sql + ' WHERE provider = ?', [provider]);
    } else {
      rows = await all<any>(this.db, sql);
    }

    return rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      profile: row.profile,
      api_key: this.decrypt(row.api_key),
      api_secret: this.decrypt(row.api_secret),
      environment: row.environment,
      permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  // OAuth state operations
  async saveOAuthState(state: OAuthState): Promise<void> {
    await this.ensureInitialized();
    
    await run(this.db, `
      INSERT INTO oauth_states (state, provider, profile, pkce_code_verifier, scopes, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      state.state,
      state.provider,
      state.profile,
      state.pkce?.codeVerifier || null,
      JSON.stringify(state.scopes),
      state.createdAt,
      state.expiresAt,
    ]);
  }

  async getOAuthState(state: string): Promise<OAuthState | undefined> {
    await this.ensureInitialized();
    
    const row = await get<any>(this.db,
      'SELECT * FROM oauth_states WHERE state = ?',
      [state]
    );

    if (!row) return undefined;

    return {
      state: row.state,
      provider: row.provider,
      profile: row.profile,
      pkce: row.pkce_code_verifier ? {
        codeVerifier: row.pkce_code_verifier,
        codeChallenge: '', // Not stored, regenerated if needed
        codeChallengeMethod: 'S256',
      } : undefined,
      scopes: JSON.parse(row.scopes),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async deleteOAuthState(state: string): Promise<void> {
    await this.ensureInitialized();
    await run(this.db, 'DELETE FROM oauth_states WHERE state = ?', [state]);
  }

  async cleanupExpiredStates(): Promise<void> {
    await this.ensureInitialized();
    const now = Math.floor(Date.now() / 1000);
    await run(this.db, 'DELETE FROM oauth_states WHERE expires_at < ?', [now]);
  }

  close(): void {
    if (!this.isClosed) {
      this.isClosed = true;
      this.db.close();
    }
  }
}
