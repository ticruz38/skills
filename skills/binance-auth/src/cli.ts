#!/usr/bin/env node
/**
 * Binance Auth CLI
 * Command-line interface for managing Binance API credentials
 */

import { 
  BinanceAuthClient, 
  getConnectedProfiles, 
  healthCheckAll, 
  disconnectAll,
  BinanceEnvironment
} from './index';

const args = process.argv.slice(2);
const command = args[0];

function showHelp(): void {
  console.log(`
Binance Auth CLI - Manage Binance API credentials

Usage:
  node dist/cli.js <command> [options]

Commands:
  status                              Show connection status
  connect <profile>                   Connect a Binance API key
    --key, -k <api_key>               API key (64 characters)
    --secret, -s <api_secret>         API secret (64 characters)
    --env, -e <environment>           Environment: production|testnet (default: production)
  
  health [profile]                    Check health of connection(s)
  list                                List all connected profiles
  validate <profile>                  Validate API key permissions
  balance <profile>                   Get account balance
  disconnect <profile>                Disconnect and remove credentials
  disconnect-all                      Disconnect all profiles
  
  help                                Show this help message

Examples:
  node dist/cli.js status
  node dist/cli.js connect prod --key xxx... --secret yyy... --env production
  node dist/cli.js connect test --key xxx... --secret yyy... --env testnet
  node dist/cli.js health prod
  node dist/cli.js balance prod
`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith('-')) {
        options[key] = value;
        i++;
      } else {
        options[key] = 'true';
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const value = argv[i + 1];
      if (value && !value.startsWith('-')) {
        options[key] = value;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  
  return options;
}

async function showStatus(): Promise<void> {
  console.log('Binance Auth Status\n');
  
  const profiles = await getConnectedProfiles();
  
  if (profiles.length === 0) {
    console.log('No Binance accounts connected.');
    console.log('\nTo connect an account, run:');
    console.log('  node dist/cli.js connect <profile> --key <key> --secret <secret> --env <env>');
    return;
  }
  
  console.log(`Connected profiles: ${profiles.length}\n`);
  
  // Show health for all profiles
  const healthResults = await healthCheckAll();
  
  for (const result of healthResults) {
    const statusIcon = result.status === 'healthy' ? '✓' : '✗';
    console.log(`  ${statusIcon} ${result.profile}: ${result.status}`);
    if (result.message) {
      console.log(`    ${result.message}`);
    }
  }
}

async function connectProfile(profile: string, options: Record<string, string>): Promise<void> {
  if (!profile) {
    console.error('Error: Profile name is required');
    console.log('Usage: node dist/cli.js connect <profile> --key <key> --secret <secret> [--env <env>]');
    process.exit(1);
  }
  
  const apiKey = options.key || options.k;
  const apiSecret = options.secret || options.s;
  const environment = (options.env || options.e || 'production') as BinanceEnvironment;
  
  if (!apiKey) {
    console.error('Error: API key is required (--key)');
    process.exit(1);
  }
  
  if (!apiSecret) {
    console.error('Error: API secret is required (--secret)');
    process.exit(1);
  }
  
  if (environment !== 'production' && environment !== 'testnet') {
    console.error('Error: Environment must be "production" or "testnet"');
    process.exit(1);
  }
  
  console.log(`Connecting Binance profile "${profile}"...`);
  console.log(`Environment: ${environment}`);
  
  const client = new BinanceAuthClient(profile);
  const result = await client.connect({
    apiKey,
    apiSecret,
    environment,
  });
  
  if (result.success) {
    console.log('\n✓ Successfully connected!');
    console.log(`  Permissions: ${result.permissions?.join(', ') || 'None'}`);
    console.log(`  Can Trade: ${result.canTrade ? 'Yes' : 'No'}`);
    console.log(`  Can Withdraw: ${result.canWithdraw ? 'Yes' : 'No'}`);
  } else {
    console.error('\n✗ Connection failed');
    console.error(`  Error: ${result.error}`);
    process.exit(1);
  }
}

async function checkHealth(profile?: string): Promise<void> {
  if (profile) {
    const client = new BinanceAuthClient(profile);
    const result = await client.healthCheck();
    
    console.log(`Health check for "${profile}":`);
    console.log(`  Status: ${result.status}`);
    if (result.message) {
      console.log(`  Message: ${result.message}`);
    }
  } else {
    console.log('Health check for all Binance profiles:\n');
    const results = await healthCheckAll();
    
    if (results.length === 0) {
      console.log('No connected profiles found.');
      return;
    }
    
    for (const result of results) {
      const icon = result.status === 'healthy' ? '✓' : '✗';
      console.log(`  ${icon} ${result.profile}: ${result.status}`);
      if (result.message) {
        console.log(`      ${result.message}`);
      }
    }
  }
}

async function listProfiles(): Promise<void> {
  const profiles = await getConnectedProfiles();
  
  console.log('Connected Binance Profiles\n');
  
  if (profiles.length === 0) {
    console.log('No profiles connected.');
    return;
  }
  
  for (const profile of profiles) {
    const client = new BinanceAuthClient(profile);
    const creds = await client.getCredentials();
    console.log(`  ${profile}`);
    if (creds) {
      console.log(`    API Key: ${creds.apiKey.substring(0, 8)}...${creds.apiKey.substring(creds.apiKey.length - 4)}`);
      console.log(`    Environment: ${creds.environment}`);
      if (creds.permissions) {
        console.log(`    Permissions: ${creds.permissions.join(', ')}`);
      }
    }
  }
}

async function validateProfile(profile: string): Promise<void> {
  if (!profile) {
    console.error('Error: Profile name is required');
    console.log('Usage: node dist/cli.js validate <profile>');
    process.exit(1);
  }
  
  const client = new BinanceAuthClient(profile);
  
  if (!(await client.isConnected())) {
    console.error(`Error: Profile "${profile}" is not connected`);
    process.exit(1);
  }
  
  console.log(`Validating API key for "${profile}"...\n`);
  
  const result = await client.validatePermissions();
  
  console.log(`  Valid: ${result.valid ? 'Yes' : 'No'}`);
  console.log(`  Can Trade: ${result.canTrade ? 'Yes' : 'No'}`);
  console.log(`  Can Withdraw: ${result.canWithdraw ? 'Yes' : 'No'}`);
  console.log(`  Permissions: ${result.permissions.join(', ') || 'None'}`);
}

async function getBalance(profile: string): Promise<void> {
  if (!profile) {
    console.error('Error: Profile name is required');
    console.log('Usage: node dist/cli.js balance <profile>');
    process.exit(1);
  }
  
  const client = new BinanceAuthClient(profile);
  
  if (!(await client.isConnected())) {
    console.error(`Error: Profile "${profile}" is not connected`);
    process.exit(1);
  }
  
  console.log(`Fetching balance for "${profile}"...\n`);
  
  try {
    const balance = await client.getBalance();
    
    if (!balance) {
      console.error('Error: Failed to fetch balance');
      process.exit(1);
    }
    
    console.log(`Permissions: ${balance.permissions.join(', ')}`);
    console.log(`\nBalances (non-zero only):\n`);
    
    if (balance.balances.length === 0) {
      console.log('  No balances found.');
    } else {
      // Sort by total value (free + locked)
      const sorted = balance.balances.sort((a, b) => {
        const totalA = parseFloat(a.free) + parseFloat(a.locked);
        const totalB = parseFloat(b.free) + parseFloat(b.locked);
        return totalB - totalA;
      });
      
      // Show header
      console.log('  Asset        Free              Locked            Total');
      console.log('  ' + '-'.repeat(70));
      
      for (const bal of sorted.slice(0, 20)) { // Show top 20
        const total = parseFloat(bal.free) + parseFloat(bal.locked);
        console.log(
          `  ${bal.asset.padEnd(12)} ${bal.free.padStart(16)} ${bal.locked.padStart(16)} ${total.toFixed(8).padStart(16)}`
        );
      }
      
      if (sorted.length > 20) {
        console.log(`  ... and ${sorted.length - 20} more assets`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function disconnectProfile(profile: string): Promise<void> {
  if (!profile) {
    console.error('Error: Profile name is required');
    console.log('Usage: node dist/cli.js disconnect <profile>');
    process.exit(1);
  }
  
  const client = new BinanceAuthClient(profile);
  
  if (!(await client.isConnected())) {
    console.error(`Error: Profile "${profile}" is not connected`);
    process.exit(1);
  }
  
  const success = await client.disconnect();
  
  if (success) {
    console.log(`✓ Disconnected profile "${profile}"`);
  } else {
    console.error(`✗ Failed to disconnect profile "${profile}"`);
    process.exit(1);
  }
}

async function disconnectAllProfiles(): Promise<void> {
  const count = await disconnectAll();
  console.log(`✓ Disconnected ${count} profile(s)`);
}

// Main command handler
async function main(): Promise<void> {
  const options = parseArgs(args.slice(1));
  
  switch (command) {
    case 'status':
      await showStatus();
      break;
      
    case 'connect':
      await connectProfile(args[1], options);
      break;
      
    case 'health':
      await checkHealth(args[1]);
      break;
      
    case 'list':
      await listProfiles();
      break;
      
    case 'validate':
      await validateProfile(args[1]);
      break;
      
    case 'balance':
      await getBalance(args[1]);
      break;
      
    case 'disconnect':
      await disconnectProfile(args[1]);
      break;
      
    case 'disconnect-all':
      await disconnectAllProfiles();
      break;
      
    case 'help':
    case '--help':
    case '-h':
    default:
      if (!command) {
        await showStatus();
      } else {
        showHelp();
      }
      break;
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
