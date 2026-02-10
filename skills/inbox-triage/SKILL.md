---
name: inbox-triage
description: "AI-powered email prioritization and triage system. Automatically classifies emails by category and priority, with bulk actions and undo support."
version: 1.0.0
author: OpenClaw
entry: ./dist/cli.js
type: script
---

# Inbox Triage Skill

AI-powered email prioritization and triage system that automatically classifies emails by category and priority, helping you focus on what matters most.

## Features

- **AI Classification**: Automatically categorizes emails into 9 categories (urgent, important, newsletter, promotional, social, updates, forums, spam, unknown)
- **Priority Scoring**: Assigns priority levels (critical, high, medium, low, none) with 0-100 score
- **Smart Triage**: Analyzes sender patterns, subject keywords, and content indicators
- **Bulk Actions**: Archive, mark as read, or trash multiple emails at once
- **Undo Support**: Undo bulk actions within 24 hours
- **Sender Rules**: Create custom rules for specific senders
- **Review Workflow**: Track which emails have been reviewed
- **Statistics**: Detailed breakdown of email distribution

## Installation

```bash
npm install
npm run build
```

## Prerequisites

Requires the email skill to be configured:

```bash
# Connect your Google account with Gmail
node ../google-oauth/dist/cli.js connect default gmail
```

## CLI Usage

### Check Status

```bash
# Check system health
node dist/cli.js status
node dist/cli.js health
```

### Triage Inbox

```bash
# Classify and sort inbox by priority
node dist/cli.js triage

# Limit to top 10 emails
node dist/cli.js triage 10
```

### Classify Single Email

```bash
node dist/cli.js classify <message-id>
```

### View by Category

```bash
# View urgent emails
node dist/cli.js category urgent

# View promotional emails
node dist/cli.js category promotional 50
```

### View by Priority

```bash
# View critical priority emails
node dist/cli.js priority critical

# View high priority
node dist/cli.js priority high 20
```

### Review Workflow

```bash
# List unreviewed emails
node dist/cli.js unreviewed

# Mark specific email as reviewed
node dist/cli.js mark-reviewed <message-id>

# Manually correct classification
node dist/cli.js set-category <message-id> important
node dist/cli.js set-priority <message-id> high
```

### Bulk Actions

```bash
# Archive multiple emails
node dist/cli.js archive <id1> <id2> <id3>

# Mark as read
node dist/cli.js mark-read <id1> <id2>

# Move to trash
node dist/cli.js trash <id1> <id2>

# Undo last bulk action
node dist/cli.js undo
```

### Sender Rules

```bash
# Add rule for specific sender
node dist/cli.js add-rule boss@company.com urgent critical
node dist/cli.js add-rule newsletter@example.com newsletter low

# List all rules
node dist/cli.js rules

# Delete rule
node dist/cli.js delete-rule newsletter@example.com
```

### Statistics

```bash
# View triage statistics
node dist/cli.js stats
```

## JavaScript/TypeScript API

### Initialize

```typescript
import { InboxTriageSkill } from '@openclaw/inbox-triage';

const triage = new InboxTriageSkill();
// Or for specific profile
const workTriage = InboxTriageSkill.forProfile('work');
```

### Triage Inbox

```typescript
const results = await triage.classifyInbox(50);

for (const result of results) {
  console.log(`${result.email.subject}: ${result.classification.priority}`);
  console.log(`  Category: ${result.classification.category}`);
  console.log(`  Score: ${result.classification.priorityScore}`);
  console.log(`  Action: ${result.classification.actionSuggested}`);
}
```

### Classify Single Email

```typescript
const classification = await triage.classify('message-id');

console.log('Category:', classification.category);
console.log('Priority:', classification.priority);
console.log('Confidence:', classification.confidence);
console.log('Reasons:', classification.reasons);
```

### Query by Category/Priority

```typescript
// Get important emails
const important = await triage.listByCategory('important', 20);

// Get critical priority
const critical = await triage.listByPriority('critical');

// Get unreviewed
const unreviewed = await triage.getUnreviewed(50);
```

### Review and Correct

```typescript
// Mark as reviewed (no changes)
await triage.review('message-id', {});

// Correct classification
await triage.review('message-id', {
  category: 'important',
  priority: 'high'
});
```

### Bulk Actions

```typescript
// Archive multiple emails
const result = await triage.bulkArchive(['id1', 'id2', 'id3']);
console.log(`Archived ${result.success.length} emails`);

// Mark as read
await triage.bulkMarkAsRead(['id1', 'id2']);

// Move to trash
await triage.bulkTrash(['id1', 'id2']);

// Undo last action
await triage.undoLastAction();
```

### Sender Rules

```typescript
// Add rule
await triage.addSenderRule(
  'boss@company.com',
  'urgent',
  'critical',
  'notify_immediately'
);

// Get rule
const rule = await triage.getSenderRule('sender@example.com');

// List all rules
const rules = await triage.listSenderRules();

// Delete rule
await triage.deleteSenderRule('sender@example.com');
```

### Statistics

```typescript
const stats = await triage.getStats();

console.log('Total classified:', stats.totalClassified);
console.log('Unreviewed:', stats.unreviewed);
console.log('By category:', stats.byCategory);
console.log('By priority:', stats.byPriority);
```

## Categories

| Category | Description |
|----------|-------------|
| `urgent` | Time-sensitive, requires immediate attention |
| `important` | High-value emails requiring response |
| `newsletter` | Regular newsletters and digests |
| `promotional` | Sales, offers, marketing |
| `social` | Social media notifications |
| `updates` | System updates, changelogs |
| `forums` | Discussion forum updates |
| `spam` | Junk mail (should be rare) |
| `unknown` | Could not be classified |

## Priorities

| Priority | Score Range | Description |
|----------|-------------|-------------|
| `critical` | 80-100 | Reply immediately |
| `high` | 60-79 | Review today |
| `medium` | 40-59 | Review this week |
| `low` | 20-39 | Review when convenient |
| `none` | 0-19 | Can archive |

## Classification Algorithm

The skill uses a multi-factor scoring algorithm:

1. **Sender Analysis**: Matches against sender rules and known patterns
2. **Subject Keywords**: Scans for urgent, promotional, newsletter indicators
3. **Content Indicators**: Analyzes snippet for key phrases
4. **Gmail Labels**: Considers `is:important` and other labels
5. **Thread Status**: Replies and forwards get slight boost

Confidence is calculated based on pattern matching strength.

## Storage

Classification data is stored in:
```
~/.openclaw/skills/inbox-triage/{profile}.db
```

Tables:
- `classifications` - Email classifications with metadata
- `sender_rules` - Custom rules per sender
- `undo_actions` - Bulk action history (24hr retention)
- `action_history` - Audit trail of manual reviews

## Multi-Profile Support

```typescript
import { InboxTriageSkill } from '@openclaw/inbox-triage';

// Work account
const work = InboxTriageSkill.forProfile('work');
const workResults = await work.classifyInbox(20);

// Personal account
const personal = InboxTriageSkill.forProfile('personal');
const personalResults = await personal.classifyInbox(20);
```

Each profile maintains separate classifications and rules.

## Error Handling

```typescript
try {
  await triage.classifyInbox(50);
} catch (error) {
  if (error.message.includes('Not connected')) {
    console.log('Please authenticate email skill first');
  } else {
    console.error('Error:', error.message);
  }
}
```

## Testing

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Check health
npm run cli -- health

# Triage inbox
npm run cli -- triage 10
```

## Dependencies

- `@openclaw/email`: For Gmail access
- `sqlite3`: Local storage

## Security Notes

- Classification data stored locally
- No email content sent to external services
- All processing done via local algorithm
- Undo actions expire after 24 hours
