#!/usr/bin/env node

import { WebSearchSkill, SearchResult } from './index';

interface CommandArgs {
  command: string;
  args: string[];
  options: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): CommandArgs {
  const args: string[] = [];
  const options: Record<string, string | boolean> = {};
  let command = '';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    
    if (!command && !arg.startsWith('-')) {
      command = arg;
    } else if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        options[key] = value;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        options[key] = argv[++i];
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        options[key] = argv[++i];
      } else {
        options[key] = true;
      }
    } else {
      args.push(arg);
    }
  }

  return { command, args, options };
}

function formatResult(result: SearchResult, index: number): string {
  const lines = [
    `${index + 1}. ${result.title}`,
    `   URL: ${result.url}`,
    `   Source: ${result.source} | Rank: ${result.rank}`,
    `   ${result.snippet}`,
    ''
  ];
  return lines.join('\n');
}

async function searchCommand(skill: WebSearchSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: web-search search <query> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --num, -n <number>    Number of results (default: 10)');
    console.log('  --safe                Enable safe search (default: true)');
    console.log('  --no-safe             Disable safe search');
    console.log('');
    console.log('Examples:');
    console.log('  web-search search "TypeScript best practices"');
    console.log('  web-search search "machine learning" --num 5');
    process.exit(1);
  }

  const query = args.join(' ');
  const numResults = parseInt(options.num as string || options.n as string || '10', 10);
  const safeSearch = options['no-safe'] ? false : (options.safe !== false);

  console.log(`Searching for: "${query}"...`);
  console.log('');

  try {
    const response = await skill.search(query, { numResults, safeSearch });

    console.log(`Found ${response.totalResults} results${response.fromCache ? ' (from cache)' : ''} in ${response.searchTime}ms`);
    console.log('');

    if (response.results.length === 0) {
      console.log('No results found.');
      return;
    }

    response.results.forEach((result, index) => {
      console.log(formatResult(result, index));
    });
  } catch (err) {
    console.error('Search failed:', err);
    process.exit(1);
  }
}

async function cacheCommand(skill: WebSearchSkill): Promise<void> {
  try {
    const stats = await skill.getCacheStats();
    
    console.log('Cache Statistics');
    console.log('================');
    console.log(`Total entries: ${stats.totalEntries}`);
    
    if (stats.oldestEntry) {
      console.log(`Oldest entry: ${stats.oldestEntry}`);
    }
    if (stats.newestEntry) {
      console.log(`Newest entry: ${stats.newestEntry}`);
    }
  } catch (err) {
    console.error('Failed to get cache stats:', err);
    process.exit(1);
  }
}

async function clearCacheCommand(skill: WebSearchSkill, options: Record<string, string | boolean>): Promise<void> {
  const days = options.days ? parseInt(options.days as string, 10) : undefined;
  
  try {
    const deleted = await skill.clearCache(days);
    
    if (days) {
      console.log(`Cleared ${deleted} cache entries older than ${days} days.`);
    } else {
      console.log(`Cleared all ${deleted} cache entries.`);
    }
  } catch (err) {
    console.error('Failed to clear cache:', err);
    process.exit(1);
  }
}

async function healthCommand(skill: WebSearchSkill): Promise<void> {
  try {
    const health = await skill.healthCheck();
    
    console.log('Health Check');
    console.log('============');
    console.log(`Status: ${health.status}`);
    console.log(`API Available: ${health.apiAvailable ? 'Yes' : 'No'}`);
    console.log(`Message: ${health.message}`);
    
    if (!health.apiAvailable) {
      console.log('');
      console.log('To enable automated search results, set the SERPER_API_KEY environment variable.');
      console.log('Get a free API key at https://serper.dev');
    }
  } catch (err) {
    console.error('Health check failed:', err);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { command, args, options } = parseArgs(process.argv);
  const skill = new WebSearchSkill({ enableCache: true });

  try {
    switch (command) {
      case 'search':
      case 's':
        await searchCommand(skill, args, options);
        break;
      
      case 'cache':
        await cacheCommand(skill);
        break;
      
      case 'clear-cache':
      case 'clear':
        await clearCacheCommand(skill, options);
        break;
      
      case 'health':
      case 'h':
        await healthCommand(skill);
        break;
      
      default:
        console.log('Web Search CLI');
        console.log('');
        console.log('Usage: web-search <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  search, s <query>     Search the web');
        console.log('  cache                 View cache statistics');
        console.log('  clear-cache           Clear search cache');
        console.log('  health, h             Check system health');
        console.log('');
        console.log('Options for search:');
        console.log('  --num, -n <number>    Number of results (default: 10)');
        console.log('  --safe                Enable safe search');
        console.log('  --no-safe             Disable safe search');
        console.log('');
        console.log('Options for clear-cache:');
        console.log('  --days <number>       Clear entries older than N days');
        console.log('');
        console.log('Examples:');
        console.log('  web-search search "TypeScript tutorial"');
        console.log('  web-search search "machine learning" --num 5');
        console.log('  web-search clear-cache --days 7');
        process.exit(1);
    }
  } finally {
    await skill.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
