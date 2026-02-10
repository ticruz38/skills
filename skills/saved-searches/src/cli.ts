#!/usr/bin/env node

import { SavedSearchesSkill } from './index';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const skill = new SavedSearchesSkill();

  try {
    switch (command) {
      case 'health':
      case 'status': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.status}`);
        console.log(`Message: ${health.message}`);
        process.exit(health.status === 'healthy' ? 0 : 1);
        break;
      }

      case 'create': {
        const name = args[1];
        const query = args[2];
        const type = args[3] as 'web' | 'news';
        
        if (!name || !query || !type) {
          console.error('Usage: create <name> <query> <web|news> [--schedule <minutes>]');
          process.exit(1);
        }

        if (!['web', 'news'].includes(type)) {
          console.error('Type must be "web" or "news"');
          process.exit(1);
        }

        const scheduleIndex = args.indexOf('--schedule');
        const scheduleMinutes = scheduleIndex !== -1 ? parseInt(args[scheduleIndex + 1]) : undefined;

        const search = await skill.createSearch(name, query, type, { scheduleMinutes });
        console.log(`Created saved search:`);
        console.log(`  ID: ${search.id}`);
        console.log(`  Name: ${search.name}`);
        console.log(`  Query: ${search.query}`);
        console.log(`  Type: ${search.type}`);
        if (search.scheduleMinutes) {
          console.log(`  Schedule: Every ${search.scheduleMinutes} minutes`);
        }
        break;
      }

      case 'list': {
        const type = args[1] as 'web' | 'news' | undefined;
        const activeOnly = args.includes('--active');
        
        const searches = await skill.listSearches(type, activeOnly);
        
        if (searches.length === 0) {
          console.log('No saved searches found.');
          break;
        }

        console.log(`Found ${searches.length} saved search(es):\n`);
        for (const search of searches) {
          const statusIcon = search.isActive ? '●' : '○';
          const scheduleInfo = search.scheduleMinutes 
            ? ` (every ${search.scheduleMinutes}m)` 
            : '';
          console.log(`${statusIcon} [${search.id}] ${search.name} [${search.type}]${scheduleInfo}`);
          console.log(`   Query: "${search.query}"`);
          if (search.lastRunAt) {
            console.log(`   Last run: ${new Date(search.lastRunAt).toLocaleString()}`);
          }
          if (search.nextRunAt) {
            console.log(`   Next run: ${new Date(search.nextRunAt).toLocaleString()}`);
          }
          if (search.runCount > 0) {
            console.log(`   Run count: ${search.runCount}`);
          }
          console.log();
        }
        break;
      }

      case 'get': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: get <id>');
          process.exit(1);
        }

        const search = await skill.getSearch(id);
        if (!search) {
          console.error(`Search with ID ${id} not found.`);
          process.exit(1);
        }

        console.log(`Saved Search #${search.id}:`);
        console.log(`  Name: ${search.name}`);
        console.log(`  Query: "${search.query}"`);
        console.log(`  Type: ${search.type}`);
        console.log(`  Status: ${search.isActive ? 'Active' : 'Inactive'}`);
        if (search.scheduleMinutes) {
          console.log(`  Schedule: Every ${search.scheduleMinutes} minutes`);
        }
        if (search.lastRunAt) {
          console.log(`  Last run: ${new Date(search.lastRunAt).toLocaleString()}`);
        }
        if (search.nextRunAt) {
          console.log(`  Next run: ${new Date(search.nextRunAt).toLocaleString()}`);
        }
        console.log(`  Run count: ${search.runCount}`);
        console.log(`  Created: ${new Date(search.createdAt!).toLocaleString()}`);
        break;
      }

      case 'update': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: update <id> [--name <name>] [--query <query>] [--active|--inactive] [--schedule <minutes>|none]');
          process.exit(1);
        }

        const updates: any = {};
        
        const nameIndex = args.indexOf('--name');
        if (nameIndex !== -1) updates.name = args[nameIndex + 1];

        const queryIndex = args.indexOf('--query');
        if (queryIndex !== -1) updates.query = args[queryIndex + 1];

        if (args.includes('--active')) updates.isActive = true;
        if (args.includes('--inactive')) updates.isActive = false;

        const scheduleIndex = args.indexOf('--schedule');
        if (scheduleIndex !== -1) {
          const value = args[scheduleIndex + 1];
          updates.scheduleMinutes = value === 'none' ? null : parseInt(value);
        }

        await skill.updateSearch(id, updates);
        console.log(`Updated search ${id}.`);
        break;
      }

      case 'delete': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: delete <id>');
          process.exit(1);
        }

        await skill.deleteSearch(id);
        console.log(`Deleted search ${id}.`);
        break;
      }

      case 'run': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: run <id>');
          process.exit(1);
        }

        console.log(`Running search ${id}...`);
        const { snapshot, comparison } = await skill.runSearch(id);

        console.log(`\nSearch completed!`);
        console.log(`  Total results: ${snapshot.resultCount}`);
        console.log(`  New items: ${comparison.newItems.length}`);
        console.log(`  Changed items: ${comparison.changedItems.length}`);
        console.log(`  Removed items: ${comparison.removedItems.length}`);
        console.log(`  Unchanged items: ${comparison.unchangedItems.length}`);

        if (comparison.newItems.length > 0) {
          console.log('\n--- New Items ---');
          comparison.newItems.slice(0, 5).forEach((item, i) => {
            console.log(`${i + 1}. ${item.title}`);
            if (item.url || item.link) console.log(`   URL: ${item.url || item.link}`);
          });
          if (comparison.newItems.length > 5) {
            console.log(`... and ${comparison.newItems.length - 5} more`);
          }
        }
        break;
      }

      case 'run-all': {
        console.log('Running all due searches...\n');
        const results = await skill.runAllDue();

        if (results.length === 0) {
          console.log('No searches due to run.');
          break;
        }

        for (const { search, result } of results) {
          console.log(`[${search.name}]`);
          console.log(`  Total: ${result.snapshot.resultCount}`);
          console.log(`  New: ${result.comparison.newItems.length}`);
          console.log(`  Changed: ${result.comparison.changedItems.length}`);
          console.log(`  Removed: ${result.comparison.removedItems.length}`);
          console.log();
        }
        break;
      }

      case 'snapshots': {
        const id = parseInt(args[1]);
        const limit = parseInt(args[2]) || 10;
        
        if (isNaN(id)) {
          console.error('Usage: snapshots <searchId> [limit]');
          process.exit(1);
        }

        const snapshots = await skill.getSnapshots(id, limit);
        if (snapshots.length === 0) {
          console.log('No snapshots found.');
          break;
        }

        console.log(`Snapshots for search ${id}:\n`);
        for (const snap of snapshots) {
          console.log(`[${snap.id}] ${new Date(snap.createdAt).toLocaleString()}`);
          console.log(`  Total: ${snap.resultCount} | New: ${snap.newItems.length} | Changed: ${snap.changedItems.length} | Removed: ${snap.removedItems.length}`);
        }
        break;
      }

      case 'alerts': {
        const idIndex = args.indexOf('--search');
        const searchId = idIndex !== -1 ? parseInt(args[idIndex + 1]) : undefined;
        const unreadOnly = args.includes('--unread');

        const alerts = await skill.getAlerts(searchId, unreadOnly);
        
        if (alerts.length === 0) {
          console.log('No alerts found.');
          break;
        }

        console.log(`Found ${alerts.length} alert(s):\n`);
        for (const alert of alerts) {
          const icon = alert.isRead ? '✓' : '●';
          const typeColor = alert.alertType === 'new_item' ? 'NEW' : 
                           alert.alertType === 'changed' ? 'CHG' : 'DEL';
          console.log(`${icon} [${alert.id}] [${typeColor}] ${alert.message}`);
          console.log(`   Search: ${alert.savedSearchId} | Snapshot: ${alert.snapshotId}`);
          console.log(`   ${new Date(alert.createdAt).toLocaleString()}`);
        }
        break;
      }

      case 'mark-read': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          if (args[1] === '--all') {
            const searchIdIndex = args.indexOf('--search');
            const searchId = searchIdIndex !== -1 ? parseInt(args[searchIdIndex + 1]) : undefined;
            const count = await skill.markAllAlertsRead(searchId);
            console.log(`Marked ${count} alerts as read.`);
            break;
          }
          console.error('Usage: mark-read <id> | mark-read --all [--search <searchId>]]');
          process.exit(1);
        }

        await skill.markAlertRead(id);
        console.log(`Marked alert ${id} as read.`);
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('Saved Searches Statistics:');
        console.log(`  Total searches: ${stats.totalSearches}`);
        console.log(`  Active searches: ${stats.activeSearches}`);
        console.log(`  Web searches: ${stats.webSearches}`);
        console.log(`  News searches: ${stats.newsSearches}`);
        console.log(`  Scheduled searches: ${stats.scheduledSearches}`);
        console.log(`  Total snapshots: ${stats.totalSnapshots}`);
        console.log(`  Total alerts: ${stats.totalAlerts}`);
        console.log(`  Unread alerts: ${stats.unreadAlerts}`);
        break;
      }

      case 'due': {
        const due = await skill.getDueSearches();
        if (due.length === 0) {
          console.log('No searches due to run.');
          break;
        }

        console.log(`${due.length} search(es) due to run:\n`);
        for (const search of due) {
          console.log(`[${search.id}] ${search.name}`);
          console.log(`  Next run: ${search.nextRunAt ? new Date(search.nextRunAt).toLocaleString() : 'ASAP'}`);
        }
        break;
      }

      case 'help':
      default:
        console.log('Saved Searches CLI');
        console.log('');
        console.log('Commands:');
        console.log('  status|health                  Check system health');
        console.log('  create <name> <query> <type>   Create a new saved search');
        console.log('                                 [--schedule <minutes>]');
        console.log('  list [web|news] [--active]     List all saved searches');
        console.log('  get <id>                       Get search details');
        console.log('  update <id> [options]          Update a search');
        console.log('                                 [--name <name>] [--query <query>]');
        console.log('                                 [--active|--inactive] [--schedule <m>|none]');
        console.log('  delete <id>                    Delete a search');
        console.log('  run <id>                       Run a search now');
        console.log('  run-all                        Run all due searches');
        console.log('  snapshots <searchId> [limit]   View search snapshots');
        console.log('  alerts [--search <id>] [--unread]  View alerts');
        console.log('  mark-read <id>                 Mark alert as read');
        console.log('  mark-read --all [--search <id>]  Mark all alerts as read');
        console.log('  due                            Show searches due to run');
        console.log('  stats                          Show statistics');
        console.log('  help                           Show this help');
        break;
    }
  } catch (err) {
    console.error(`Error: ${err}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
