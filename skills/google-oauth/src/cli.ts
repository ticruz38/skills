#!/usr/bin/env node
/**
 * Google OAuth Skill CLI
 * Command-line interface for Google OAuth operations
 */

import { 
  GoogleOAuthClient, 
  getConnectedProfiles, 
  hasAnyConnection,
  disconnectAll,
  healthCheckAll,
  GoogleService,
  GoogleScopes,
  getScopesForServices,
  getAuthProvider
} from './index';

// ANSI colors for terminal output
const colors = {
  green: '\x1b[92m',
  red: '\x1b[91m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const success = (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg: string) => console.error(`${colors.red}✗${colors.reset} ${msg}`);
const info = (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
const warning = (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);

function printHelp(): void {
  console.log(`
${colors.bold}Google OAuth Skill CLI${colors.reset}

Commands:
  status [profile]              Check connection status
  connect <profile> [services]  Initiate OAuth flow
  complete <profile> <code> <state>  Complete OAuth with code
  disconnect [profile]          Disconnect Google account
  health [profile]              Check token health
  profiles                      List all connected profiles
  scopes                        List available OAuth scopes

Services (comma-separated):
  gmail, calendar, drive, sheets, docs, people, all

Examples:
  # Check status of default profile
  google-oauth status

  # Check specific profile
  google-oauth status work

  # Connect with Gmail only
  google-oauth connect default gmail

  # Connect with all services
  google-oauth connect default all

  # Complete OAuth
  google-oauth complete default "AUTH_CODE" "STATE"

  # Disconnect all profiles
  google-oauth disconnect

  # Check health of all profiles
  google-oauth health
`);
}

async function cmdStatus(profile: string = 'default'): Promise<number> {
  console.log(`${colors.bold}Google OAuth Status${colors.reset}`);
  console.log('=' .repeat(50));
  
  const client = GoogleOAuthClient.forProfile(profile);
  
  if (client.isConnected()) {
    const tokenData = await client.getTokenData();
    const email = await client.getUserEmail();
    const scopes = await client.getConnectedScopes();
    
    success('Connected to Google');
    console.log(`\n  Profile: ${colors.bold}${profile}${colors.reset}`);
    console.log(`  Account: ${colors.bold}${email || 'Unknown'}${colors.reset}`);
    
    if (tokenData?.expires_at) {
      const expiresDate = new Date(tokenData.expires_at * 1000);
      const isExpired = tokenData.expires_at < Date.now() / 1000;
      console.log(`  Expires: ${isExpired ? colors.red : colors.green}${expiresDate.toLocaleString()}${colors.reset}`);
    }
    
    if (scopes.length > 0) {
      console.log(`\n  Authorized Scopes:`);
      
      // Group by service
      const services: Record<string, string[]> = {};
      scopes.forEach(scope => {
        const parts = scope.split('/');
        const service = parts[parts.length - 2] || 'other';
        if (!services[service]) services[service] = [];
        services[service].push(parts[parts.length - 1]);
      });
      
      Object.entries(services).forEach(([service, perms]) => {
        console.log(`    ${colors.green}✓${colors.reset} ${service}: ${perms.join(', ')}`);
      });
    }
    
    return 0;
  } else {
    error('Not connected to Google');
    console.log(`\n  Profile: ${profile}`);
    console.log('\n  To connect, run:');
    console.log(`    google-oauth connect ${profile} all`);
    return 1;
  }
}

async function cmdConnect(profile: string, servicesStr: string = 'all'): Promise<number> {
  console.log(`${colors.bold}Google OAuth Connection${colors.reset}`);
  console.log('=' .repeat(50));
  
  // Parse services
  const serviceNames = servicesStr.split(',').map(s => s.trim().toLowerCase());
  const validServices: GoogleService[] = ['gmail', 'calendar', 'drive', 'sheets', 'docs', 'people', 'all'];
  
  const services = serviceNames.filter(s => validServices.includes(s as GoogleService)) as GoogleService[];
  
  if (services.length === 0) {
    error(`Invalid services: ${servicesStr}`);
    info(`Valid services: ${validServices.join(', ')}`);
    return 1;
  }
  
  const client = GoogleOAuthClient.forProfile(profile);
  
  // Check if already connected
  if (client.isConnected()) {
    const email = await client.getUserEmail();
    warning(`Already connected as ${email}`);
    info('Use "disconnect" first to reconnect with different scopes');
    return 0;
  }
  
  // Initiate auth
  info(`Requesting authorization for: ${services.join(', ')}`);
  
  const auth = client.initiateAuth(services);
  
  success('Authorization URL generated');
  console.log(`\n  URL: ${colors.blue}${auth.url}${colors.reset}`);
  console.log(`  State: ${auth.state.substring(0, 30)}...`);
  console.log(`  Scopes: ${auth.scopes.length} permissions`);
  
  console.log(`\n${colors.bold}Next Steps:${colors.reset}`);
  console.log('  1. Open the URL in a browser');
  console.log('  2. Authorize with your Google account');
  console.log('  3. Copy the authorization code');
  console.log(`  4. Run: google-oauth complete ${profile} "CODE" "${auth.state}"`);
  
  return 0;
}

async function cmdComplete(profile: string, code: string, state: string): Promise<number> {
  console.log(`${colors.bold}Completing Google OAuth${colors.reset}`);
  console.log('=' .repeat(50));
  
  const client = GoogleOAuthClient.forProfile(profile);
  
  info('Exchanging authorization code for tokens...');
  
  const result = await client.completeAuth(code, state);
  
  if (result.success) {
    success('Authentication successful!');
    console.log(`\n  Profile: ${colors.bold}${profile}${colors.reset}`);
    console.log(`  Account: ${colors.bold}${result.email}${colors.reset}`);
    if (result.name) {
      console.log(`  Name: ${result.name}`);
    }
    if (result.scopes) {
      console.log(`  Scopes: ${result.scopes.length} permissions granted`);
    }
    if (result.expiresAt) {
      const expiresDate = new Date(result.expiresAt * 1000);
      console.log(`  Expires: ${expiresDate.toLocaleString()}`);
    }
    return 0;
  } else {
    error(`Authentication failed: ${result.error}`);
    return 1;
  }
}

async function cmdDisconnect(profile?: string): Promise<number> {
  console.log(`${colors.bold}Google OAuth Disconnect${colors.reset}`);
  console.log('=' .repeat(50));
  
  if (profile) {
    const client = GoogleOAuthClient.forProfile(profile);
    if (await client.disconnect()) {
      success(`Disconnected profile: ${profile}`);
      return 0;
    } else {
      error(`Profile not connected: ${profile}`);
      return 1;
    }
  } else {
    const count = await disconnectAll();
    if (count > 0) {
      success(`Disconnected ${count} profile(s)`);
      return 0;
    } else {
      warning('No profiles were connected');
      return 0;
    }
  }
}

async function cmdHealth(profile?: string): Promise<number> {
  console.log(`${colors.bold}Google OAuth Health Check${colors.reset}`);
  console.log('=' .repeat(50));
  
  if (profile) {
    const client = GoogleOAuthClient.forProfile(profile);
    const result = await client.healthCheck();
    
    console.log(`\n  Profile: ${profile}`);
    console.log(`  Status: ${result.status === 'healthy' ? colors.green : colors.red}${result.status}${colors.reset}`);
    
    if (result.message) {
      console.log(`  Message: ${result.message}`);
    }
    
    if (result.expiresAt) {
      const expiresDate = new Date(result.expiresAt * 1000);
      console.log(`  Expires: ${expiresDate.toLocaleString()}`);
    }
    
    return result.status === 'healthy' ? 0 : 1;
  } else {
    const results = await healthCheckAll();
    
    if (results.length === 0) {
      info('No Google profiles configured');
      return 0;
    }
    
    let healthyCount = 0;
    
    results.forEach(result => {
      console.log(`\n  Profile: ${result.profile}`);
      console.log(`  Status: ${result.status === 'healthy' ? colors.green : colors.red}${result.status}${colors.reset}`);
      if (result.message) {
        console.log(`  Message: ${result.message}`);
      }
      if (result.status === 'healthy') healthyCount++;
    });
    
    console.log(`\n${healthyCount}/${results.length} profiles healthy`);
    
    return healthyCount === results.length ? 0 : 1;
  }
}

async function cmdProfiles(): Promise<number> {
  console.log(`${colors.bold}Google OAuth Profiles${colors.reset}`);
  console.log('=' .repeat(50));
  
  const profiles = await getConnectedProfiles();
  
  if (profiles.length === 0) {
    info('No Google profiles connected');
    console.log('\nTo connect a profile, run:');
    console.log('  google-oauth connect <profile> all');
    return 0;
  }
  
  success(`${profiles.length} profile(s) connected`);
  
  for (const profileName of profiles) {
    const client = GoogleOAuthClient.forProfile(profileName);
    const email = await client.getUserEmail();
    const scopes = await client.getConnectedScopes();
    console.log(`\n  ${colors.bold}${profileName}${colors.reset}`);
    console.log(`    Account: ${email || 'Unknown'}`);
    console.log(`    Services: ${scopes.length} scopes`);
  }
  
  return 0;
}

function cmdScopes(): number {
  console.log(`${colors.bold}Available Google OAuth Scopes${colors.reset}`);
  console.log('=' .repeat(50));
  
  const categories = {
    'Gmail': GoogleScopes.GMAIL,
    'Calendar': GoogleScopes.CALENDAR,
    'Drive': GoogleScopes.DRIVE,
    'Sheets': GoogleScopes.SHEETS,
    'Docs': GoogleScopes.DOCS,
    'People': GoogleScopes.PEOPLE,
  };
  
  Object.entries(categories).forEach(([name, scopes]) => {
    console.log(`\n${colors.bold}${name}${colors.reset}`);
    scopes.forEach(scope => {
      const shortName = scope.split('/').pop();
      console.log(`  • ${shortName}`);
    });
  });
  
  console.log(`\n${colors.bold}Shortcuts:${colors.reset}`);
  console.log(`  Use 'all' to request all services`);
  console.log(`  Use comma-separated list: gmail,calendar,drive`);
  
  return 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return 0;
  }
  
  const command = args[0];
  
  try {
    switch (command) {
      case 'status':
        return await cmdStatus(args[1]);
        
      case 'connect':
        if (!args[1]) {
          error('Profile name required');
          info('Usage: google-oauth connect <profile> [services]');
          return 1;
        }
        return await cmdConnect(args[1], args[2]);
        
      case 'complete':
        if (!args[1] || !args[2] || !args[3]) {
          error('Profile, code, and state required');
          info('Usage: google-oauth complete <profile> <code> <state>');
          return 1;
        }
        return await cmdComplete(args[1], args[2], args[3]);
        
      case 'disconnect':
        return await cmdDisconnect(args[1]);
        
      case 'health':
        return await cmdHealth(args[1]);
        
      case 'profiles':
        return await cmdProfiles();
        
      case 'scopes':
        return cmdScopes();
        
      default:
        error(`Unknown command: ${command}`);
        printHelp();
        return 1;
    }
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

main().then(code => process.exit(code));
