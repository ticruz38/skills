#!/usr/bin/env node

import { CompetitorMonitorSkill, Competitor, Change } from './index';

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

function formatCompetitor(competitor: Competitor): string {
  const lines = [
    `ID: ${competitor.id}`,
    `Name: ${competitor.name}`,
    `URL: ${competitor.url}`,
    `Status: ${competitor.isActive ? 'Active' : 'Inactive'}`,
    `Check Frequency: ${competitor.checkFrequency}`,
    `Last Checked: ${competitor.lastCheckedAt || 'Never'}`
  ];

  if (competitor.description) lines.push(`Description: ${competitor.description}`);
  if (competitor.alertEmail) lines.push(`Alert Email: ${competitor.alertEmail}`);
  if (competitor.keywords && competitor.keywords.length > 0) lines.push(`Keywords: ${competitor.keywords.join(', ')}`);

  return lines.join('\n');
}

function formatChange(change: Change): string {
  const severityEmoji = {
    critical: '🔴',
    major: '🟠',
    minor: '🟡',
    info: '🔵'
  };

  const lines = [
    `${severityEmoji[change.severity]} [${change.severity.toUpperCase()}] ${change.changeType}`,
    `   ${change.description}`,
    `   Detected: ${new Date(change.detectedAt).toLocaleString()}`,
    `   Status: ${change.isRead ? 'Read' : 'Unread'}`
  ];

  if (change.oldValue) lines.push(`   Old: ${change.oldValue}`);
  if (change.newValue) lines.push(`   New: ${change.newValue}`);

  return lines.join('\n');
}

// Commands
async function addCommand(skill: CompetitorMonitorSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  if (args.length < 2) {
    console.log('Usage: competitor-monitor add <name> <url> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --description <text>    Description of the competitor');
    console.log('  --frequency <type>      Check frequency: hourly, daily (default), weekly');
    console.log('  --keywords <list>       Comma-separated keywords to monitor');
    console.log('  --email <address>       Alert email address');
    console.log('  --webhook <url>         Alert webhook URL');
    console.log('');
    console.log('Examples:');
    console.log('  competitor-monitor add "Acme Corp" https://acme.com');
    console.log('  competitor-monitor add "Competitor X" https://example.com --frequency hourly --keywords "pricing,features"');
    process.exit(1);
  }

  const name = args[0];
  const url = args[1];
  const frequency = (options.frequency as string || 'daily') as 'hourly' | 'daily' | 'weekly';
  const keywords = options.keywords ? (options.keywords as string).split(',').map(k => k.trim()) : undefined;

  try {
    const competitor = await skill.addCompetitor({
      name,
      url,
      description: options.description as string,
      checkFrequency: frequency,
      isActive: true,
      alertEmail: options.email as string,
      alertWebhook: options.webhook as string,
      keywords
    });

    console.log('✓ Competitor added successfully');
    console.log('');
    console.log(formatCompetitor(competitor));
  } catch (err) {
    console.error('Failed to add competitor:', err);
    process.exit(1);
  }
}

async function listCommand(skill: CompetitorMonitorSkill, options: Record<string, string | boolean>): Promise<void> {
  const activeOnly = !options.all;

  try {
    const competitors = await skill.listCompetitors(activeOnly);

    if (competitors.length === 0) {
      console.log(activeOnly ? 'No active competitors found.' : 'No competitors found.');
      return;
    }

    console.log(`${activeOnly ? 'Active' : 'All'} Competitors (${competitors.length})`);
    console.log('');

    competitors.forEach((c, i) => {
      const status = c.isActive ? '✓' : '✗';
      console.log(`${i + 1}. ${status} ${c.name} (${c.url})`);
      console.log(`   Frequency: ${c.checkFrequency} | Last checked: ${c.lastCheckedAt || 'Never'}`);
      if (c.keywords && c.keywords.length > 0) {
        console.log(`   Keywords: ${c.keywords.join(', ')}`);
      }
      console.log('');
    });
  } catch (err) {
    console.error('Failed to list competitors:', err);
    process.exit(1);
  }
}

async function getCommand(skill: CompetitorMonitorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: competitor-monitor get <id|name>');
    process.exit(1);
  }

  const identifier = args[0];

  try {
    let competitor: Competitor | null;
    
    if (/^\d+$/.test(identifier)) {
      competitor = await skill.getCompetitor(parseInt(identifier, 10));
    } else {
      competitor = await skill.getCompetitorByName(identifier);
    }

    if (!competitor) {
      console.log('Competitor not found.');
      process.exit(1);
    }

    console.log(formatCompetitor(competitor));
  } catch (err) {
    console.error('Failed to get competitor:', err);
    process.exit(1);
  }
}

async function updateCommand(skill: CompetitorMonitorSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: competitor-monitor update <id> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --name <name>           Update name');
    console.log('  --url <url>             Update URL');
    console.log('  --description <text>    Update description');
    console.log('  --frequency <type>      Update frequency: hourly, daily, weekly');
    console.log('  --keywords <list>       Update keywords (comma-separated)');
    console.log('  --email <address>       Update alert email');
    console.log('  --enable                Enable monitoring');
    console.log('  --disable               Disable monitoring');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  const updates: Partial<Omit<Competitor, 'id' | 'createdAt'>> = {};

  if (options.name) updates.name = options.name as string;
  if (options.url) updates.url = options.url as string;
  if (options.description) updates.description = options.description as string;
  if (options.frequency) updates.checkFrequency = options.frequency as 'hourly' | 'daily' | 'weekly';
  if (options.email) updates.alertEmail = options.email as string;
  if (options.enable) updates.isActive = true;
  if (options.disable) updates.isActive = false;
  if (options.keywords) updates.keywords = (options.keywords as string).split(',').map(k => k.trim());

  try {
    const success = await skill.updateCompetitor(id, updates);
    if (success) {
      console.log('✓ Competitor updated successfully');
      const competitor = await skill.getCompetitor(id);
      if (competitor) {
        console.log('');
        console.log(formatCompetitor(competitor));
      }
    } else {
      console.log('Competitor not found or no changes made.');
    }
  } catch (err) {
    console.error('Failed to update competitor:', err);
    process.exit(1);
  }
}

async function deleteCommand(skill: CompetitorMonitorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: competitor-monitor delete <id>');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);

  try {
    const success = await skill.deleteCompetitor(id);
    if (success) {
      console.log('✓ Competitor deleted successfully');
    } else {
      console.log('Competitor not found.');
    }
  } catch (err) {
    console.error('Failed to delete competitor:', err);
    process.exit(1);
  }
}

async function checkCommand(skill: CompetitorMonitorSkill, args: string[]): Promise<void> {
  try {
    let results;

    if (args.length > 0) {
      // Check specific competitor
      const id = parseInt(args[0], 10);
      const competitor = await skill.getCompetitor(id);
      
      if (!competitor) {
        console.log('Competitor not found.');
        process.exit(1);
      }

      console.log(`Checking ${competitor.name} (${competitor.url})...`);
      const detection = await skill.detectChanges(id);
      
      console.log('');
      if (detection.hasChanged) {
        console.log(`✓ Detected ${detection.changes.length} change(s):`);
        detection.changes.forEach(change => {
          console.log('');
          console.log(formatChange(change));
        });
      } else {
        console.log('✓ No changes detected');
      }
      
      console.log('');
      console.log(`Snapshot: ${detection.snapshot.contentHash.substring(0, 16)}...`);
      console.log(`Content length: ${detection.snapshot.contentLength} bytes`);
      console.log(`HTTP status: ${detection.snapshot.httpStatus}`);
    } else {
      // Check all competitors
      console.log('Checking all competitors...');
      console.log('');
      
      results = await skill.checkAll(true);
      
      let totalChanges = 0;
      let successCount = 0;
      
      for (const result of results) {
        const status = result.success ? '✓' : '✗';
        console.log(`${status} ${result.competitor.name}: ${result.success ? result.changes.length + ' changes' : 'ERROR - ' + result.error}`);
        if (result.success) {
          totalChanges += result.changes.length;
          successCount++;
        }
      }
      
      console.log('');
      console.log(`Checked ${results.length} competitor(s), ${successCount} successful, ${totalChanges} total changes detected`);
    }
  } catch (err) {
    console.error('Failed to check competitor:', err);
    process.exit(1);
  }
}

async function changesCommand(skill: CompetitorMonitorSkill, args: string[], options: Record<string, string | boolean>): Promise<void> {
  const competitorId = args.length > 0 ? parseInt(args[0], 10) : undefined;
  const unreadOnly = !!options.unread;
  const limit = parseInt(options.limit as string || '50', 10);

  try {
    const changes = await skill.getChanges(competitorId, unreadOnly, limit);

    if (changes.length === 0) {
      console.log(unreadOnly ? 'No unread changes.' : 'No changes found.');
      return;
    }

    console.log(`${unreadOnly ? 'Unread ' : ''}Changes (${changes.length})`);
    console.log('');

    changes.forEach((change, i) => {
      console.log(formatChange(change));
      if (i < changes.length - 1) console.log('');
    });
  } catch (err) {
    console.error('Failed to get changes:', err);
    process.exit(1);
  }
}

async function readCommand(skill: CompetitorMonitorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: competitor-monitor read <id>');
    console.log('');
    console.log('Use "all" to mark all changes as read:');
    console.log('  competitor-monitor read all');
    process.exit(1);
  }

  try {
    if (args[0] === 'all') {
      const changes = await skill.getChanges(undefined, true, 9999);
      let marked = 0;
      
      for (const change of changes) {
        if (await skill.markChangeRead(change.id!, true)) {
          marked++;
        }
      }
      
      console.log(`✓ Marked ${marked} change(s) as read`);
    } else {
      const id = parseInt(args[0], 10);
      const success = await skill.markChangeRead(id, true);
      
      if (success) {
        console.log('✓ Change marked as read');
      } else {
        console.log('Change not found.');
      }
    }
  } catch (err) {
    console.error('Failed to mark change as read:', err);
    process.exit(1);
  }
}

async function snapshotsCommand(skill: CompetitorMonitorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: competitor-monitor snapshots <competitor-id> [limit]');
    process.exit(1);
  }

  const competitorId = parseInt(args[0], 10);
  const limit = args.length > 1 ? parseInt(args[1], 10) : 10;

  try {
    const competitor = await skill.getCompetitor(competitorId);
    if (!competitor) {
      console.log('Competitor not found.');
      process.exit(1);
    }

    const snapshots = await skill.getSnapshots(competitorId, limit);

    if (snapshots.length === 0) {
      console.log('No snapshots found.');
      return;
    }

    console.log(`Snapshots for ${competitor.name} (${snapshots.length})`);
    console.log('');

    snapshots.forEach((s, i) => {
      console.log(`${i + 1}. ${new Date(s.fetchedAt).toLocaleString()}`);
      console.log(`   Hash: ${s.contentHash.substring(0, 16)}...`);
      console.log(`   Size: ${s.contentLength} bytes | Status: ${s.httpStatus}`);
      console.log(`   Preview: ${s.contentPreview.substring(0, 100)}...`);
      if (i < snapshots.length - 1) console.log('');
    });
  } catch (err) {
    console.error('Failed to get snapshots:', err);
    process.exit(1);
  }
}

async function statsCommand(skill: CompetitorMonitorSkill): Promise<void> {
  try {
    const stats = await skill.getStats();
    const summary = await skill.getAlertSummary();

    console.log('Competitor Monitor Statistics');
    console.log('==============================');
    console.log('');
    console.log('Competitors:');
    console.log(`  Total: ${stats.totalCompetitors}`);
    console.log(`  Active: ${stats.activeCompetitors}`);
    console.log(`  Inactive: ${stats.totalCompetitors - stats.activeCompetitors}`);
    console.log('');
    console.log('Snapshots:');
    console.log(`  Total: ${stats.totalSnapshots}`);
    console.log('');
    console.log('Changes:');
    console.log(`  Total: ${stats.totalChanges}`);
    console.log(`  Unread: ${stats.unreadChanges}`);
    if (summary.critical > 0) console.log(`  🔴 Critical: ${summary.critical}`);
    if (summary.major > 0) console.log(`  🟠 Major: ${summary.major}`);
    if (summary.minor > 0) console.log(`  🟡 Minor: ${summary.minor}`);
    if (summary.info > 0) console.log(`  🔵 Info: ${summary.info}`);
    console.log('');
    console.log(`Last check: ${stats.lastCheck ? new Date(stats.lastCheck).toLocaleString() : 'Never'}`);
  } catch (err) {
    console.error('Failed to get stats:', err);
    process.exit(1);
  }
}

async function analyzeCommand(skill: CompetitorMonitorSkill, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Usage: competitor-monitor analyze <competitor-id> [days]');
    process.exit(1);
  }

  const competitorId = parseInt(args[0], 10);
  const days = args.length > 1 ? parseInt(args[1], 10) : 30;

  try {
    const competitor = await skill.getCompetitor(competitorId);
    if (!competitor) {
      console.log('Competitor not found.');
      process.exit(1);
    }

    const analysis = await skill.analyzeChanges(competitorId, days);

    console.log(`Change Analysis for ${competitor.name}`);
    console.log(`Period: Last ${days} days`);
    console.log('');
    console.log(`Total Changes: ${analysis.totalChanges}`);
    console.log(`Average per day: ${analysis.averageChangesPerDay.toFixed(2)}`);
    console.log(`Trend: ${analysis.trend}`);
    console.log('');
    
    if (Object.keys(analysis.changesByType).length > 0) {
      console.log('Changes by Type:');
      for (const [type, count] of Object.entries(analysis.changesByType)) {
        console.log(`  ${type}: ${count}`);
      }
      console.log('');
    }
    
    if (Object.keys(analysis.changesBySeverity).length > 0) {
      console.log('Changes by Severity:');
      for (const [severity, count] of Object.entries(analysis.changesBySeverity)) {
        const emoji = { critical: '🔴', major: '🟠', minor: '🟡', info: '🔵' }[severity] || '';
        console.log(`  ${emoji} ${severity}: ${count}`);
      }
    }
  } catch (err) {
    console.error('Failed to analyze changes:', err);
    process.exit(1);
  }
}

async function healthCommand(skill: CompetitorMonitorSkill): Promise<void> {
  try {
    const health = await skill.healthCheck();

    console.log('Health Check');
    console.log('============');
    console.log(`Status: ${health.status}`);
    console.log(`Message: ${health.message}`);
    console.log('');
    console.log('Dependencies:');
    console.log(`  Web Search: ${health.dependencies.webSearch ? '✓' : '✗'}`);
  } catch (err) {
    console.error('Health check failed:', err);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { command, args, options } = parseArgs(process.argv);
  const skill = new CompetitorMonitorSkill();

  try {
    switch (command) {
      case 'add':
        await addCommand(skill, args, options);
        break;

      case 'list':
      case 'ls':
        await listCommand(skill, options);
        break;

      case 'get':
        await getCommand(skill, args);
        break;

      case 'update':
        await updateCommand(skill, args, options);
        break;

      case 'delete':
      case 'rm':
        await deleteCommand(skill, args);
        break;

      case 'check':
        await checkCommand(skill, args);
        break;

      case 'changes':
        await changesCommand(skill, args, options);
        break;

      case 'read':
      case 'mark-read':
        await readCommand(skill, args);
        break;

      case 'snapshots':
        await snapshotsCommand(skill, args);
        break;

      case 'stats':
        await statsCommand(skill);
        break;

      case 'analyze':
        await analyzeCommand(skill, args);
        break;

      case 'health':
      case 'h':
        await healthCommand(skill);
        break;

      default:
        console.log('Competitor Monitor CLI');
        console.log('');
        console.log('Usage: competitor-monitor <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  add <name> <url>        Add a competitor to monitor');
        console.log('  list, ls                List all competitors');
        console.log('  get <id|name>           Get competitor details');
        console.log('  update <id>             Update competitor settings');
        console.log('  delete, rm <id>         Delete a competitor');
        console.log('');
        console.log('  check [id]              Check for changes (all or specific)');
        console.log('  changes [id]            View detected changes');
        console.log('  read <id|all>           Mark change(s) as read');
        console.log('  snapshots <id>          View competitor snapshots');
        console.log('');
        console.log('  stats                   View statistics');
        console.log('  analyze <id> [days]     Analyze change patterns');
        console.log('  health, h               Check system health');
        console.log('');
        console.log('Global Options:');
        console.log('  --all                   Include inactive items');
        console.log('  --unread                Show only unread changes');
        console.log('  --limit <n>             Limit number of results');
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
