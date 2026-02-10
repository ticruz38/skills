#!/usr/bin/env node
/**
 * Auth Provider CLI
 * Command-line interface for managing authentication credentials
 */

import { AuthProvider, AuthProviderOptions } from './index';
import { ProviderType } from './types';

function printUsage(): void {
  console.log(`
Auth Provider CLI - Manage OAuth tokens and API keys

Usage:
  auth-provider <command> [options]

Commands:
  status                              Show all stored credentials status
  health [provider] [profile]         Check health of credentials
  
  init <provider> <profile>           Generate OAuth authorization URL
  complete <provider> <code> <state>  Complete OAuth flow with code
  
  save-apikey <provider> <profile>    Save API key credentials
    --key <api_key>                   API key
    --secret <api_secret>             API secret
    --env <environment>               Environment (production/sandbox/testnet)
  
  get <provider> [profile]            Get stored credentials
  delete <provider> [profile]         Delete stored credentials
  list [provider]                     List all credentials
  
  env-check                           Check environment configuration

Providers:
  google, binance, quickbooks, slack

Examples:
  auth-provider status
  auth-provider health google default
  auth-provider init google default
  auth-provider complete google <code> <state>
  auth-provider save-apikey binance prod --key xxx --secret yyy --env production
  auth-provider get google default
  auth-provider delete binance test
`);
}

function parseArgs(args: string[]): { command: string; options: any; flags: any } {
  const options: any = {};
  const flags: any = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] || '',
    options: { positional: positional.slice(1) },
    flags,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const { command, options, flags } = parseArgs(args);
  const providerOptions: AuthProviderOptions = {};

  const auth = new AuthProvider(providerOptions);

  try {
    switch (command) {
      case 'status': {
        console.log('Auth Provider Status\n');
        
        const tokens = await auth.listTokens();
        const apiKeys = await auth.listApiKeys();

        console.log('OAuth Tokens:');
        if (tokens.length === 0) {
          console.log('  No tokens stored');
        } else {
          for (const token of tokens) {
            const expires = token.expires_at 
              ? new Date(token.expires_at * 1000).toLocaleString()
              : 'never';
            console.log(`  ${token.provider}/${token.profile}: expires ${expires}`);
          }
        }

        console.log('\nAPI Keys:');
        if (apiKeys.length === 0) {
          console.log('  No API keys stored');
        } else {
          for (const key of apiKeys) {
            console.log(`  ${key.provider}/${key.profile}: ${key.environment}`);
          }
        }
        break;
      }

      case 'health': {
        const provider = options.positional[0] as ProviderType;
        const profile = options.positional[1] || 'default';

        if (!provider) {
          // Check all
          const results = await auth.healthCheckAll();
          console.log(JSON.stringify(results, null, 2));
        } else {
          const result = await auth.healthCheck(provider, profile);
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case 'init': {
        const provider = options.positional[0] as ProviderType;
        const profile = options.positional[1] || 'default';

        if (!provider) {
          console.error('Error: Provider required');
          process.exit(1);
        }

        if (!auth.isProviderAvailable(provider)) {
          console.error(`Error: Provider ${provider} not configured. Check environment variables.`);
          process.exit(1);
        }

        const result = auth.initiateAuth(provider, profile);
        console.log(JSON.stringify({
          success: true,
          authorizationUrl: result.url,
          state: result.state,
          expiresAt: new Date(result.expiresAt * 1000).toISOString(),
        }, null, 2));
        break;
      }

      case 'complete': {
        const provider = options.positional[0] as ProviderType;
        const code = options.positional[1];
        const state = options.positional[2];

        if (!provider || !code || !state) {
          console.error('Error: Provider, code, and state required');
          process.exit(1);
        }

        const token = await auth.completeAuth(provider, code, state);
        console.log(JSON.stringify({
          success: true,
          provider: token.provider,
          profile: token.profile,
          expires_at: token.expires_at,
        }, null, 2));
        break;
      }

      case 'save-apikey': {
        const provider = options.positional[0] as ProviderType;
        const profile = options.positional[1] || 'default';
        const apiKey = flags.key;
        const apiSecret = flags.secret;
        const env = flags.env || 'production';

        if (!provider || !apiKey || !apiSecret) {
          console.error('Error: Provider, --key, and --secret required');
          process.exit(1);
        }

        await auth.saveApiKey(
          provider,
          profile,
          apiKey,
          apiSecret,
          env as 'production' | 'sandbox' | 'testnet'
        );

        console.log(JSON.stringify({
          success: true,
          message: `API key saved for ${provider}/${profile}`,
        }, null, 2));
        break;
      }

      case 'get': {
        const provider = options.positional[0] as ProviderType;
        const profile = options.positional[1] || 'default';

        if (!provider) {
          console.error('Error: Provider required');
          process.exit(1);
        }

        const token = await auth.getToken(provider, profile);
        const apiKey = await auth.getApiKey(provider, profile);

        console.log(JSON.stringify({
          token: token ? {
            provider: token.provider,
            profile: token.profile,
            expires_at: token.expires_at,
            scope: token.scope,
          } : null,
          apiKey: apiKey ? {
            provider: apiKey.provider,
            profile: apiKey.profile,
            environment: apiKey.environment,
          } : null,
        }, null, 2));
        break;
      }

      case 'delete': {
        const provider = options.positional[0] as ProviderType;
        const profile = options.positional[1] || 'default';

        if (!provider) {
          console.error('Error: Provider required');
          process.exit(1);
        }

        await auth.deleteToken(provider, profile);
        await auth.deleteApiKey(provider, profile);

        console.log(JSON.stringify({
          success: true,
          message: `Credentials deleted for ${provider}/${profile}`,
        }, null, 2));
        break;
      }

      case 'list': {
        const providerFilter = options.positional[0] as ProviderType | undefined;
        
        const tokens = await auth.listTokens(providerFilter);
        const apiKeys = await auth.listApiKeys(providerFilter);

        console.log(JSON.stringify({
          tokens: tokens.map(t => ({
            provider: t.provider,
            profile: t.profile,
            expires_at: t.expires_at,
          })),
          apiKeys: apiKeys.map(k => ({
            provider: k.provider,
            profile: k.profile,
            environment: k.environment,
          })),
        }, null, 2));
        break;
      }

      case 'env-check': {
        const envVars = {
          GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓' : '✗',
          GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓' : '✗',
          QUICKBOOKS_CLIENT_ID: process.env.QUICKBOOKS_CLIENT_ID ? '✓' : '✗',
          QUICKBOOKS_CLIENT_SECRET: process.env.QUICKBOOKS_CLIENT_SECRET ? '✓' : '✗',
          SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID ? '✓' : '✗',
          SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET ? '✓' : '✗',
          AUTH_PROVIDER_KEY: process.env.AUTH_PROVIDER_KEY ? '✓' : '✗ (will use random)',
        };

        console.log('Environment Configuration:\n');
        for (const [key, status] of Object.entries(envVars)) {
          console.log(`  ${key}: ${status}`);
        }

        console.log('\nProvider Status:');
        const providers: ProviderType[] = ['google', 'binance', 'quickbooks', 'slack'];
        for (const provider of providers) {
          const available = auth.isProviderAvailable(provider);
          console.log(`  ${provider}: ${available ? '✓ configured' : '✗ not configured'}`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
    
    // Close database connection after all operations complete
    auth.close();
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    auth.close();
    process.exit(1);
  }
}

main();
