---
title: Saved Searches
skill_id: saved-searches
version: 1.0.0
description: Save and rerun searches automatically with result comparison and new item detection
dependencies:
  - web-search
  - news-aggregator
---

# Saved Searches

Save and rerun searches automatically with result comparison and new item detection.

## Features

- **Save Search Queries**: Store web and news searches for repeated execution
- **Scheduled Execution**: Run searches automatically at specified intervals
- **Result Comparison**: Compare current results with previous snapshots
- **New Item Detection**: Detect and alert on new, changed, or removed items
- **Alert System**: Get notified about important changes
- **Snapshot History**: Keep a history of all search results

## Usage

### TypeScript API

```typescript
import { SavedSearchesSkill } from '@openclaw/saved-searches';

const skill = new SavedSearchesSkill();

// Create a saved search
const search = await skill.createSearch('Tech News', 'artificial intelligence', 'news', {
  scheduleMinutes: 60  // Run every hour
});

// Run the search manually
const { snapshot, comparison } = await skill.runSearch(search.id!);

console.log(`Found ${snapshot.resultCount} results`);
console.log(`New items: ${comparison.newItems.length}`);
console.log(`Changed items: ${comparison.changedItems.length}`);

// Get alerts
const alerts = await skill.getAlerts(undefined, true);  // unread only
for (const alert of alerts) {
  console.log(`${alert.alertType}: ${alert.message}`);
}

// Run all due searches
await skill.runAllDue();

await skill.close();
```

### CLI Usage

```bash
# Create a web search
npx saved-searches create "AI News" "artificial intelligence" web --schedule 60

# Create a news aggregator search
npx saved-searches create "Tech News" "technology" news --schedule 30

# List all searches
npx saved-searches list
npx saved-searches list web --active

# Run a search manually
npx saved-searches run 1

# View snapshots
npx saved-searches snapshots 1 10

# Check alerts
npx saved-searches alerts --unread
npx saved-searches mark-read --all

# View statistics
npx saved-searches stats
```

## Data Storage

Data is stored in SQLite at `~/.openclaw/skills/saved-searches/data.db`:

- **saved_searches**: Search configurations with schedule settings
- **search_snapshots**: Historical results with comparison data
- **search_alerts**: Alert notifications for changes

## Configuration

### Schedule Intervals

- Set `scheduleMinutes` to automatically run searches
- Searches run when `next_run_at` is reached
- Use `run-all` or `runAllDue()` to execute due searches

### Search Types

- **web**: Uses web-search skill for web searches
- **news**: Uses news-aggregator skill for RSS feeds

## Alert Types

- **new_item**: New items found in search results
- **changed**: Existing items have changed
- **removed**: Items no longer in search results

## Integration

Use with cron or systemd for scheduled execution:

```bash
# Run every 15 minutes
*/15 * * * * npx saved-searches run-all
```
