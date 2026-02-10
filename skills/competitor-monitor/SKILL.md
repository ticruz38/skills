# Competitor Monitor

Monitor competitor website changes with automated change detection and alert notifications.

## Overview

Track competitor websites and get notified when they make changes. The skill monitors website content, tracks changes using content hashing, and provides alerts for important updates.

## Features

- **Website Monitoring**: Track any publicly accessible website
- **Change Detection**: Content hash comparison for accurate change detection
- **Keyword Monitoring**: Get alerted when specific keywords appear or disappear
- **Change Classification**: Changes categorized by type (content, status, keyword) and severity (info, minor, major, critical)
- **Snapshot History**: Keep historical snapshots of competitor websites
- **Alert Management**: Unread/read status for tracking reviewed changes
- **Analysis Tools**: Trend analysis and change statistics

## Installation

```bash
cd skills/competitor-monitor
npm install
npm run build
```

## Configuration

No external API keys required. The skill uses direct HTTP fetching for website monitoring.

## Usage

### Add a Competitor

```bash
# Basic usage
competitor-monitor add "Acme Corp" https://acme.com

# With monitoring options
competitor-monitor add "Competitor X" https://example.com \
  --frequency hourly \
  --keywords "pricing,features,launch" \
  --email alerts@yourcompany.com
```

### Check for Changes

```bash
# Check all competitors
competitor-monitor check

# Check specific competitor
competitor-monitor check 1
```

### View Changes

```bash
# All changes
competitor-monitor changes

# Changes for specific competitor
competitor-monitor changes 1

# Only unread changes
competitor-monitor changes --unread
```

### View Snapshots

```bash
competitor-monitor snapshots 1
```

### Analysis

```bash
# View statistics
competitor-monitor stats

# Analyze change patterns
competitor-monitor analyze 1 30
```

## API Usage

```typescript
import { CompetitorMonitorSkill } from '@openclaw/competitor-monitor';

const monitor = new CompetitorMonitorSkill();

// Add a competitor
const competitor = await monitor.addCompetitor({
  name: 'Acme Corp',
  url: 'https://acme.com',
  checkFrequency: 'daily',
  keywords: ['pricing', 'new product'],
  isActive: true
});

// Check for changes
const result = await monitor.detectChanges(competitor.id!);
if (result.hasChanged) {
  console.log('Changes detected:', result.changes);
}

// Get all unread changes
const changes = await monitor.getChanges(undefined, true);

// Close connection
await monitor.close();
```

## Database Schema

### Competitors Table
- `id` - Primary key
- `name` - Competitor name
- `url` - Website URL to monitor
- `description` - Optional description
- `check_frequency` - hourly, daily, or weekly
- `is_active` - Whether monitoring is active
- `alert_email` - Email for alerts
- `alert_webhook` - Webhook URL for alerts
- `keywords` - JSON array of keywords to monitor

### Snapshots Table
- `id` - Primary key
- `competitor_id` - Foreign key to competitor
- `content_hash` - SHA256 hash of content
- `content_preview` - Text preview of content
- `http_status` - HTTP response code
- `content_length` - Content size in bytes
- `fetched_at` - Timestamp

### Changes Table
- `id` - Primary key
- `competitor_id` - Foreign key to competitor
- `snapshot_id` - Foreign key to snapshot
- `change_type` - content, status, keyword_match
- `severity` - info, minor, major, critical
- `description` - Human-readable change description
- `is_read` - Whether change has been reviewed
- `detected_at` - Timestamp

## CLI Reference

| Command | Description |
|---------|-------------|
| `add <name> <url>` | Add a competitor to monitor |
| `list` | List all competitors |
| `get <id\|name>` | Get competitor details |
| `update <id>` | Update competitor settings |
| `delete <id>` | Delete a competitor |
| `check [id]` | Check for changes |
| `changes [id]` | View detected changes |
| `read <id\|all>` | Mark change(s) as read |
| `snapshots <id>` | View snapshots |
| `stats` | View statistics |
| `analyze <id>` | Analyze change patterns |
| `health` | Check system health |

## Change Types

- **content** - Website content has changed
- **status** - HTTP status code changed
- **keyword_match** - Monitored keyword detected in content
- **screenshot** - Visual change detected (placeholder for future)

## Severity Levels

- 🔴 **critical** - Site down (4xx/5xx errors)
- 🟠 **major** - Significant content changes (>50%)
- 🟡 **minor** - Moderate content changes (20-50%)
- 🔵 **info** - Minor changes (<20%)
