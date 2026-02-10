/**
 * Google OAuth Skill
 * OAuth2 integration for Gmail, Calendar, Drive, Sheets
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

class GoogleOAuthSkill {
  constructor() {
    this.name = 'google-oauth';
    this.minionBaseUrl = null;
    this.instanceId = null;
    this.apiKey = null;
    this.tokenDir = null;
  }

  async init(config) {
    this.minionBaseUrl = config.MINION_BASE_URL || 'https://minion.do';
    this.instanceId = config.OPENCLAW_INSTANCE_ID || 'openclaw-local';
    this.apiKey = config.MINION_API_KEY || '';
    this.tokenDir = config.GOOGLE_TOKEN_DIR || path.join(require('os').homedir(), '.openclaw', 'google-tokens');

    // Ensure token directory exists
    try {
      await fs.mkdir(this.tokenDir, { recursive: true, mode: 0o700 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _getChatHash(chatId) {
    return crypto.createHash('sha256').update(chatId).digest('hex').substring(0, 16);
  }

  _getTokenPath(chatId, service = 'combined') {
    const hash = this._getChatHash(chatId);
    return path.join(this.tokenDir, `${service}-${hash}.json`);
  }

  async checkStatus({ chat_id }) {
    const tokenPath = this._getTokenPath(chat_id);
    try {
      await fs.access(tokenPath);
      const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
      return {
        connected: true,
        email: token.email || 'unknown',
        services: token.services || []
      };
    } catch {
      return { connected: false };
    }
  }

  async getAuthUrl({ chat_id, services = ['gmail', 'calendar', 'drive'] }) {
    const scopes = this._getScopesForServices(services);
    
    // Call Python auth client to get URL
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'scripts', 'google_auth.py');
      const args = [
        scriptPath,
        '--chat-id', chat_id,
        '--services', services.join(','),
        '--minion-url', this.minionBaseUrl,
        '--instance-id', this.instanceId
      ];

      if (this.apiKey) {
        args.push('--api-key', this.apiKey);
      }

      const python = spawn('python3', args, { capture: ['stdout', 'stderr'] });
      
      let output = '';
      python.stdout.on('data', (data) => { output += data; });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Auth script failed: ${output}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch {
            resolve({ auth_url: output.trim(), state: 'pending' });
          }
        }
      });
    });
  }

  async getGmailService({ chat_id }) {
    const status = await this.checkStatus({ chat_id });
    if (!status.connected) {
      throw new Error('User not connected. Call getAuthUrl first.');
    }
    
    // Return service config for Python scripts
    return {
      token_path: this._getTokenPath(chat_id),
      chat_id,
      requires_python: true,
      script: 'google_services.py'
    };
  }

  async getCalendarService({ chat_id }) {
    const status = await this.checkStatus({ chat_id });
    if (!status.connected) {
      throw new Error('User not connected. Call getAuthUrl first.');
    }
    
    return {
      token_path: this._getTokenPath(chat_id),
      chat_id,
      requires_python: true,
      script: 'google_services.py'
    };
  }

  async getDriveService({ chat_id }) {
    const status = await this.checkStatus({ chat_id });
    if (!status.connected) {
      throw new Error('User not connected. Call getAuthUrl first.');
    }
    
    return {
      token_path: this._getTokenPath(chat_id),
      chat_id,
      requires_python: true,
      script: 'google_services.py'
    };
  }

  async disconnect({ chat_id }) {
    const services = ['gmail', 'calendar', 'drive', 'combined'];
    const hash = this._getChatHash(chat_id);
    
    for (const svc of services) {
      const tokenPath = path.join(this.tokenDir, `${svc}-${hash}.json`);
      try {
        await fs.unlink(tokenPath);
      } catch {
        // File may not exist
      }
    }
    
    return { disconnected: true };
  }

  async health() {
    try {
      await fs.access(this.tokenDir);
      return { 
        status: 'healthy',
        token_dir: this.tokenDir,
        minion_url: this.minionBaseUrl
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message 
      };
    }
  }

  _getScopesForServices(services) {
    const scopeMap = {
      gmail: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels'
      ],
      calendar: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      drive: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ],
      sheets: [
        'https://www.googleapis.com/auth/spreadsheets'
      ],
      docs: [
        'https://www.googleapis.com/auth/documents'
      ]
    };

    const scopes = [];
    for (const svc of services) {
      if (scopeMap[svc]) {
        scopes.push(...scopeMap[svc]);
      }
    }
    return [...new Set(scopes)];
  }
}

module.exports = GoogleOAuthSkill;
