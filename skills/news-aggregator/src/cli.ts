#!/usr/bin/env node

import { NewsAggregatorSkill, FeedSource, FeedItem } from './index';

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Source Commands
async function sourcesCommand(skill: NewsAggregatorSkill): Promise<void> {
  try {
    const sources = await skill.getSources();
    
    console.log('Feed Sources');
    console.log('============');
    console.log('');
    
    if (sources.length === 0) {
      console.log('No sources configured. Use "add" command to add feeds.');
      return;
    }
    
    sources.forEach(source => {
      const status = source.isActive ? '✓' : '✗';
      const category = source.category ? ` [${source.category}]` : '';
      const errors = source.fetchErrorCount > 0 ? ` (${source.fetchErrorCount} errors)` : '';
      console.log(`${status} ${source.id}: ${source.name}${category}${errors}`);
      console.log(`   URL: ${source.url}`);
      if (source.lastFetchAt) {
        console.log(`   Last fetch: ${formatDate(source.lastFetchAt)}`);
      }
      console.log('');
    });
  } catch (err) {
    console.error('Failed to get sources:', err);
    process.exit(1);
  }
}

async function addSourceCommand(skill: NewsAggregatorSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  if (args.length < 2) {
    console.log('Usage: news-aggregator add <name> <url> [--category <cat>]');
    console.log('');
    console.log('Examples:');
    console.log('  news-aggregator add "TechCrunch" "https://techcrunch.com/feed/"');
    console.log('  news-aggregator add "Hacker News" "https://news.ycombinator.com/rss" --category tech');
    process.exit(1);
  }

  const [name, url] = args;
  const category = options.category as string | undefined;

  try {
    const source = await skill.addSource(name, url, category);
    console.log(`✓ Added source: ${source.name}`);
    console.log(`  ID: ${source.id}`);
    console.log(`  URL: ${source.url}`);
    if (category) console.log(`  Category: ${category}`);
  } catch (err) {
    console.error('Failed to add source:', err);
    process.exit(1);
  }
}

async function removeSourceCommand(skill: NewsAggregatorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: news-aggregator remove <id>');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    console.error('Invalid ID');
    process.exit(1);
  }

  try {
    const source = await skill.getSource(id);
    if (!source) {
      console.error(`Source ${id} not found`);
      process.exit(1);
    }

    await skill.deleteSource(id);
    console.log(`✓ Removed source: ${source.name}`);
  } catch (err) {
    console.error('Failed to remove source:', err);
    process.exit(1);
  }
}

async function enableSourceCommand(skill: NewsAggregatorSkill, args: string[], enable: boolean): Promise<void> {
  if (args.length === 0) {
    console.log(`Usage: news-aggregator ${enable ? 'enable' : 'disable'} <id>`);
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    console.error('Invalid ID');
    process.exit(1);
  }

  try {
    await skill.updateSource(id, { isActive: enable });
    console.log(`✓ Source ${id} ${enable ? 'enabled' : 'disabled'}`);
  } catch (err) {
    console.error('Failed to update source:', err);
    process.exit(1);
  }
}

// Feed Commands
async function fetchCommand(skill: NewsAggregatorSkill, args: string[]): Promise<void> {
  try {
    let results;
    
    if (args.length > 0) {
      // Fetch specific source
      const id = parseInt(args[0], 10);
      if (isNaN(id)) {
        console.error('Invalid source ID');
        process.exit(1);
      }

      const source = await skill.getSource(id);
      if (!source) {
        console.error(`Source ${id} not found`);
        process.exit(1);
      }

      console.log(`Fetching ${source.name}...`);
      results = [await skill.fetchSource(source)];
    } else {
      // Fetch all sources
      console.log('Fetching all sources...');
      results = await skill.fetchAllSources();
    }

    console.log('');
    console.log('Fetch Results');
    console.log('=============');
    console.log('');

    let totalAdded = 0;
    let totalUpdated = 0;
    let errors = 0;

    results.forEach(result => {
      const status = result.errors.length === 0 ? '✓' : '⚠';
      console.log(`${status} ${result.source.name}`);
      console.log(`   Added: ${result.itemsAdded}, Updated: ${result.itemsUpdated}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.log(`     - ${err}`));
        errors += result.errors.length;
      }
      console.log('');
      totalAdded += result.itemsAdded;
      totalUpdated += result.itemsUpdated;
    });

    console.log(`Total: ${totalAdded} added, ${totalUpdated} updated${errors > 0 ? `, ${errors} errors` : ''}`);
  } catch (err) {
    console.error('Fetch failed:', err);
    process.exit(1);
  }
}

async function listCommand(skill: NewsAggregatorSkill, options: Record<string, string | boolean>): Promise<void> {
  try {
    const limit = parseInt(options.limit as string || options.l as string || '20', 10);
    const unreadOnly = options.unread === true;
    const savedOnly = options.saved === true;
    const sourceId = options.source ? parseInt(options.source as string, 10) : undefined;

    const result = await skill.getItems({
      sourceId,
      isRead: unreadOnly ? false : undefined,
      isSaved: savedOnly ? true : undefined,
      limit
    });

    console.log('Feed Items');
    console.log('==========');
    console.log('');

    if (result.items.length === 0) {
      console.log('No items found.');
      return;
    }

    result.items.forEach(item => {
      const status = item.isRead ? ' ' : '●';
      const saved = item.isSaved ? ' ★' : '';
      console.log(`${status}${saved} [${item.id}] ${item.title}`);
      console.log(`   ${truncate(item.description, 100)}`);
      console.log(`   ${formatDate(item.pubDate)} | ${item.link}`);
      console.log('');
    });

    console.log(`Showing ${result.items.length} of ${result.totalCount} items (page ${result.page})`);
  } catch (err) {
    console.error('Failed to list items:', err);
    process.exit(1);
  }
}

async function readCommand(skill: NewsAggregatorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: news-aggregator read <id>');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    console.error('Invalid ID');
    process.exit(1);
  }

  try {
    const item = await skill.getItem(id);
    if (!item) {
      console.error(`Item ${id} not found`);
      process.exit(1);
    }

    console.log(item.title);
    console.log('='.repeat(item.title.length));
    console.log('');
    console.log(`Published: ${formatDate(item.pubDate)}`);
    if (item.author) console.log(`Author: ${item.author}`);
    console.log(`Link: ${item.link}`);
    if (item.categories.length > 0) console.log(`Categories: ${item.categories.join(', ')}`);
    console.log('');
    console.log(item.description);
    console.log('');

    // Mark as read
    await skill.markAsRead(id, true);
  } catch (err) {
    console.error('Failed to read item:', err);
    process.exit(1);
  }
}

async function markReadCommand(skill: NewsAggregatorSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  try {
    if (options.all === true) {
      const sourceId = args.length > 0 ? parseInt(args[0], 10) : undefined;
      const count = await skill.markAllAsRead(isNaN(sourceId!) ? undefined : sourceId);
      console.log(`✓ Marked ${count} items as read`);
    } else {
      if (args.length === 0) {
        console.log('Usage: news-aggregator mark-read <id> [--all] [<source_id>]');
        process.exit(1);
      }

      const id = parseInt(args[0], 10);
      if (isNaN(id)) {
        console.error('Invalid ID');
        process.exit(1);
      }

      await skill.markAsRead(id, true);
      console.log(`✓ Marked item ${id} as read`);
    }
  } catch (err) {
    console.error('Failed to mark as read:', err);
    process.exit(1);
  }
}

async function saveCommand(skill: NewsAggregatorSkill, args: string[], save: boolean): Promise<void> {
  if (args.length === 0) {
    console.log(`Usage: news-aggregator ${save ? 'save' : 'unsave'} <id>`);
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    console.error('Invalid ID');
    process.exit(1);
  }

  try {
    await skill.saveItem(id, save);
    console.log(`✓ Item ${id} ${save ? 'saved' : 'unsaved'}`);
  } catch (err) {
    console.error('Failed to update item:', err);
    process.exit(1);
  }
}

// Filter Commands
async function filtersCommand(skill: NewsAggregatorSkill): Promise<void> {
  try {
    const filters = await skill.getKeywordFilters();

    console.log('Keyword Filters');
    console.log('===============');
    console.log('');

    if (filters.length === 0) {
      console.log('No filters configured. Use "filter-add" command to add filters.');
      return;
    }

    console.log('Include filters:');
    filters.filter(f => f.isInclude).forEach(f => {
      console.log(`  + "${f.keyword}" (priority: ${f.priority})`);
    });

    console.log('');
    console.log('Exclude filters:');
    filters.filter(f => !f.isInclude).forEach(f => {
      console.log(`  - "${f.keyword}" (priority: ${f.priority})`);
    });
  } catch (err) {
    console.error('Failed to get filters:', err);
    process.exit(1);
  }
}

async function addFilterCommand(skill: NewsAggregatorSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: news-aggregator filter-add <keyword> [--exclude] [--priority <n>]');
    console.log('');
    console.log('Examples:');
    console.log('  news-aggregator filter-add "typescript"');
    console.log('  news-aggregator filter-add "spam" --exclude');
    console.log('  news-aggregator filter-add "urgent" --priority 10');
    process.exit(1);
  }

  const keyword = args[0];
  const isInclude = !options.exclude;
  const priority = parseInt(options.priority as string || '0', 10);

  try {
    const filter = await skill.addKeywordFilter(keyword, isInclude, priority);
    console.log(`✓ Added ${filter.isInclude ? 'include' : 'exclude'} filter: "${filter.keyword}"`);
  } catch (err) {
    console.error('Failed to add filter:', err);
    process.exit(1);
  }
}

async function removeFilterCommand(skill: NewsAggregatorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: news-aggregator filter-remove <id>');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  if (isNaN(id)) {
    console.error('Invalid ID');
    process.exit(1);
  }

  try {
    await skill.deleteKeywordFilter(id);
    console.log(`✓ Removed filter ${id}`);
  } catch (err) {
    console.error('Failed to remove filter:', err);
    process.exit(1);
  }
}

async function filteredCommand(skill: NewsAggregatorSkill, options: Record<string, string | boolean>): Promise<void> {
  try {
    const limit = parseInt(options.limit as string || options.l as string || '20', 10);
    
    const result = await skill.getFilteredItems({ limit });

    console.log('Filtered Items');
    console.log('==============');
    console.log('');

    if (result.items.length === 0) {
      console.log('No items match the current filters.');
      return;
    }

    result.items.forEach(item => {
      const status = item.isRead ? ' ' : '●';
      console.log(`${status} [${item.id}] ${item.title}`);
      console.log(`   ${truncate(item.description, 80)}`);
      console.log(`   ${formatDate(item.pubDate)}`);
      console.log('');
    });

    console.log(`Showing ${result.items.length} of ${result.totalCount} filtered items`);
  } catch (err) {
    console.error('Failed to get filtered items:', err);
    process.exit(1);
  }
}

// Deduplication Commands
async function duplicatesCommand(skill: NewsAggregatorSkill): Promise<void> {
  try {
    const duplicates = await skill.findDuplicates();

    console.log('Duplicate Items');
    console.log('===============');
    console.log('');

    if (duplicates.length === 0) {
      console.log('No duplicates found.');
      return;
    }

    duplicates.forEach(dup => {
      console.log(`GUID: ${truncate(dup.guid, 50)}`);
      console.log(`  Count: ${dup.count}, IDs: ${dup.ids.join(', ')}`);
      console.log('');
    });

    console.log(`Found ${duplicates.length} duplicate groups`);
  } catch (err) {
    console.error('Failed to find duplicates:', err);
    process.exit(1);
  }
}

async function dedupeCommand(skill: NewsAggregatorSkill): Promise<void> {
  try {
    console.log('Removing duplicates...');
    const removed = await skill.removeDuplicates(true);
    console.log(`✓ Removed ${removed} duplicate items`);
  } catch (err) {
    console.error('Failed to remove duplicates:', err);
    process.exit(1);
  }
}

// Stats Command
async function statsCommand(skill: NewsAggregatorSkill): Promise<void> {
  try {
    const stats = await skill.getStats();

    console.log('News Aggregator Statistics');
    console.log('==========================');
    console.log('');
    console.log('Sources:');
    console.log(`  Total: ${stats.totalSources}`);
    console.log(`  Active: ${stats.activeSources}`);
    console.log('');
    console.log('Items:');
    console.log(`  Total: ${stats.totalItems}`);
    console.log(`  Unread: ${stats.unreadItems}`);
    console.log(`  Saved: ${stats.savedItems}`);
    console.log('');
    console.log('Filters:');
    console.log(`  Include: ${stats.includeFilters}`);
    console.log(`  Exclude: ${stats.excludeFilters}`);
  } catch (err) {
    console.error('Failed to get stats:', err);
    process.exit(1);
  }
}

// Health Command
async function healthCommand(skill: NewsAggregatorSkill): Promise<void> {
  try {
    const health = await skill.healthCheck();

    console.log('Health Check');
    console.log('============');
    console.log(`Status: ${health.status}`);
    console.log(`Message: ${health.message}`);
  } catch (err) {
    console.error('Health check failed:', err);
    process.exit(1);
  }
}

// Main
async function main(): Promise<void> {
  const { command, args, options } = parseArgs(process.argv);
  const skill = new NewsAggregatorSkill();

  try {
    switch (command) {
      // Source management
      case 'sources':
        await sourcesCommand(skill);
        break;
      case 'add':
        await addSourceCommand(skill, args, options);
        break;
      case 'remove':
      case 'rm':
        await removeSourceCommand(skill, args);
        break;
      case 'enable':
        await enableSourceCommand(skill, args, true);
        break;
      case 'disable':
        await enableSourceCommand(skill, args, false);
        break;

      // Feed operations
      case 'fetch':
      case 'f':
        await fetchCommand(skill, args);
        break;
      case 'list':
      case 'ls':
        await listCommand(skill, options);
        break;
      case 'read':
      case 'show':
        await readCommand(skill, args);
        break;
      case 'mark-read':
        await markReadCommand(skill, args, options);
        break;
      case 'save':
        await saveCommand(skill, args, true);
        break;
      case 'unsave':
        await saveCommand(skill, args, false);
        break;

      // Filtering
      case 'filters':
        await filtersCommand(skill);
        break;
      case 'filter-add':
        await addFilterCommand(skill, args, options);
        break;
      case 'filter-remove':
        await removeFilterCommand(skill, args);
        break;
      case 'filtered':
        await filteredCommand(skill, options);
        break;

      // Deduplication
      case 'duplicates':
        await duplicatesCommand(skill);
        break;
      case 'dedupe':
        await dedupeCommand(skill);
        break;

      // Stats & Health
      case 'stats':
        await statsCommand(skill);
        break;
      case 'health':
      case 'h':
        await healthCommand(skill);
        break;

      default:
        console.log('News Aggregator CLI');
        console.log('');
        console.log('Source Management:');
        console.log('  sources              List all feed sources');
        console.log('  add <name> <url>     Add a new feed source');
        console.log('  remove <id>          Remove a feed source');
        console.log('  enable <id>          Enable a feed source');
        console.log('  disable <id>         Disable a feed source');
        console.log('');
        console.log('Feed Operations:');
        console.log('  fetch [id]           Fetch feeds (all or specific source)');
        console.log('  list                 List feed items');
        console.log('  read <id>            Read a specific item');
        console.log('  mark-read <id>       Mark item as read');
        console.log('  mark-read --all      Mark all items as read');
        console.log('  save <id>            Save/bookmark an item');
        console.log('  unsave <id>          Remove bookmark from item');
        console.log('');
        console.log('Filtering:');
        console.log('  filters              List keyword filters');
        console.log('  filter-add <kw>      Add an include filter');
        console.log('  filter-add <kw> --exclude   Add an exclude filter');
        console.log('  filter-remove <id>   Remove a filter');
        console.log('  filtered             Show filtered items');
        console.log('');
        console.log('Deduplication:');
        console.log('  duplicates           Find duplicate items');
        console.log('  dedupe               Remove duplicate items');
        console.log('');
        console.log('Utilities:');
        console.log('  stats                Show statistics');
        console.log('  health               Check system health');
        console.log('');
        console.log('Options:');
        console.log('  --limit, -l <n>      Limit number of results');
        console.log('  --unread             Show only unread items');
        console.log('  --saved              Show only saved items');
        console.log('  --source <id>        Filter by source ID');
        console.log('  --category <cat>     Set category for source');
        console.log('  --priority <n>       Set filter priority');
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
