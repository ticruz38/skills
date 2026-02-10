---
name: email
description: "Gmail integration for reading, sending, and managing emails. Built on top of google-oauth for authentication, with SQLite caching, thread support, and full Gmail API capabilities."
version: 1.0.0
author: OpenClaw
entry: ./dist/cli.js
type: script
---

# Email Skill

Gmail integration for reading, sending, and managing emails through your agent. Built on top of the google-oauth skill for secure authentication.

## Features

- **Read & List Emails**: Browse your inbox with pagination
- **Search**: Full Gmail query syntax support
- **Send & Reply**: Compose and reply to emails
- **Thread View**: See entire conversation threads
- **Labels**: View and filter by Gmail labels
- **Attachments**: Download email attachments
- **Actions**: Star, archive, trash, mark read/unread
- **SQLite Cache**: Local metadata caching for performance

## Installation

```bash
npm install
npm run build
```

## Prerequisites

The email skill requires Gmail authorization through the google-oauth skill:

```bash
# Connect your Google account with Gmail scope
node ../google-oauth/dist/cli.js connect default gmail
```

## CLI Usage

### Check Status

```bash
# Check connection status
node dist/cli.js status

# Check specific profile
node dist/cli.js status work
```

### Health Check

```bash
node dist/cli.js health
```

### List Emails

```bash
# List 20 most recent emails
node dist/cli.js list

# List specific number
node dist/cli.js list default 10
```

### Search Emails

Use Gmail's powerful search syntax:

```bash
# Search by sender
node dist/cli.js search "from:boss@company.com"

# Unread emails from sender
node dist/cli.js search "from:client@example.com is:unread"

# Emails with attachments
node dist/cli.js search "has:attachment filename:pdf"

# Recent important emails
node dist/cli.js search "is:important after:2024/01/01"
```

### Read Email

```bash
node dist/cli.js read <message-id>
```

### View Thread

```bash
node dist/cli.js thread <thread-id>
```

### Send Email

```bash
node dist/cli.js send "recipient@example.com" "Subject" "Email body text"
```

### Reply to Email

```bash
node dist/cli.js reply <message-id> "Your reply text"
```

### Manage Emails

```bash
# Mark as read/unread
node dist/cli.js mark-read <message-id>
node dist/cli.js mark-unread <message-id>

# Star/unstar
node dist/cli.js star <message-id>
node dist/cli.js unstar <message-id>

# Archive (remove from inbox)
node dist/cli.js archive <message-id>

# Move to trash
node dist/cli.js trash <message-id>

# Delete permanently (careful!)
node dist/cli.js delete <message-id>
```

### List Labels

```bash
node dist/cli.js labels
```

## JavaScript/TypeScript API

### Initialize

```typescript
import { EmailSkill } from '@openclaw/email';

// Create skill for default profile
const email = new EmailSkill();

// Or for specific profile
const workEmail = EmailSkill.forProfile('work');
```

### Check Status

```typescript
const status = await email.getStatus();
console.log('Connected:', status.connected);
console.log('Email:', status.email);
console.log('Has Gmail:', status.hasGmailScope);
```

### List Emails

```typescript
const result = await email.list({ maxResults: 10 });

for (const msg of result.emails) {
  console.log(`${msg.id}: ${msg.subject}`);
  console.log(`  From: ${msg.from}`);
  console.log(`  Unread: ${msg.isUnread}`);
}

// Pagination
const nextPage = await email.list({
  maxResults: 10,
  pageToken: result.nextPageToken
});
```

### Search Emails

```typescript
const result = await email.search('from:boss@company.com is:unread');
console.log(`Found ${result.resultSizeEstimate} emails`);
```

### Read Full Email

```typescript
const fullEmail = await email.read('message-id');

console.log('Subject:', fullEmail.subject);
console.log('From:', fullEmail.from);
console.log('Body:', fullEmail.bodyText);
console.log('HTML:', fullEmail.bodyHtml);

// Attachments
for (const att of fullEmail.attachments) {
  console.log(`Attachment: ${att.filename} (${att.size} bytes)`);
  
  // Download
  const content = await email.getAttachment(fullEmail.id, att.id);
  fs.writeFileSync(att.filename, content);
}
```

### View Thread

```typescript
const thread = await email.getThread('thread-id');

for (const msg of thread.messages) {
  console.log(`${msg.from}: ${msg.bodyText.substring(0, 100)}...`);
}
```

### Send Email

```typescript
// Simple text email
await email.send({
  to: 'recipient@example.com',
  subject: 'Hello',
  bodyText: 'This is the email body'
});

// With CC and HTML
await email.send({
  to: ['user1@example.com', 'user2@example.com'],
  cc: 'manager@example.com',
  subject: 'Meeting Notes',
  bodyText: 'Plain text version',
  bodyHtml: '<h1>Meeting Notes</h1><p>Details...</p>'
});

// With attachments
await email.send({
  to: 'client@example.com',
  subject: 'Proposal',
  bodyText: 'Please find attached the proposal.',
  attachments: [
    {
      filename: 'proposal.pdf',
      content: fs.readFileSync('proposal.pdf'),
      mimeType: 'application/pdf'
    }
  ]
});
```

### Reply to Email

```typescript
await email.reply('message-id', {
  bodyText: 'Thanks for your email!'
});
```

### Manage Emails

```typescript
// Mark as read/unread
await email.markAsRead('message-id', true);
await email.markAsRead('message-id', false);

// Star/unstar
await email.star('message-id', true);
await email.star('message-id', false);

// Archive
await email.archive('message-id');

// Trash
await email.trash('message-id');

// Delete permanently
await email.delete('message-id');
```

### List Labels

```typescript
const labels = await email.listLabels();

for (const label of labels) {
  console.log(`${label.id}: ${label.name} (${label.type})`);
}
```

### Health Check

```typescript
const health = await email.healthCheck();

if (health.status === 'healthy') {
  console.log('Gmail API is accessible');
} else {
  console.error('Issue:', health.message);
}
```

## Gmail Query Syntax

The search function supports Gmail's full query syntax:

| Query | Description |
|-------|-------------|
| `from:sender@example.com` | Emails from specific sender |
| `to:recipient@example.com` | Emails to specific recipient |
| `cc:someone@example.com` | CC'd emails |
| `subject:meeting` | Subject contains "meeting" |
| `has:attachment` | Has any attachment |
| `filename:pdf` | Has PDF attachment |
| `is:unread` | Unread emails |
| `is:read` | Read emails |
| `is:starred` | Starred emails |
| `is:important` | Important emails |
| `in:inbox` | In inbox |
| `in:sent` | Sent emails |
| `in:trash` | In trash |
| `in:spam` | In spam |
| `label:work` | With specific label |
| `after:2024/01/01` | After date |
| `before:2024/12/31` | Before date |
| `older_than:1d` | Older than 1 day |
| `newer_than:1w` | Newer than 1 week |

Combine with operators:
- `from:boss@company.com is:unread` - Unread from boss
- `has:attachment (filename:pdf OR filename:doc)` - PDF or DOC attachments
- `subject:meeting -from:calendar@google.com` - Meeting emails not from calendar

## Storage

Cached email metadata is stored in:
```
~/.openclaw/skills/email/cache.db
```

Tables:
- `email_metadata` - Cached email headers and metadata
- `sync_history` - Sync state for incremental updates

## Multi-Profile Support

Manage multiple Gmail accounts:

```typescript
import { EmailSkill } from '@openclaw/email';

// Work account
const work = EmailSkill.forProfile('work');

// Personal account  
const personal = EmailSkill.forProfile('personal');

// Use independently
const workEmails = await work.list({ maxResults: 10 });
const personalEmails = await personal.list({ maxResults: 10 });
```

Each profile needs separate authentication:
```bash
node ../google-oauth/dist/cli.js connect work gmail
node ../google-oauth/dist/cli.js connect personal gmail
```

## Error Handling

```typescript
try {
  const emails = await email.list();
} catch (error) {
  if (error.message.includes('Not connected')) {
    console.log('Please authenticate first');
  } else if (error.message.includes('Gmail scope')) {
    console.log('Re-authenticate with Gmail permissions');
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

# Check status
npm run status

# List recent emails
npm run cli -- list default 5

# Search
npm run cli -- search "is:unread"
```

## Troubleshooting

### "Not connected" error

Authenticate with google-oauth first:
```bash
node ../google-oauth/dist/cli.js connect default gmail
```

### "Gmail scope not authorized"

Your Google account is connected but without Gmail permissions. Reconnect:
```bash
node ../google-oauth/dist/cli.js disconnect default
node ../google-oauth/dist/cli.js connect default gmail
```

### API errors

Check health status:
```bash
node dist/cli.js health
```

## Dependencies

- `@openclaw/google-oauth`: For Gmail authentication
- `@openclaw/auth-provider`: Base authentication (via google-oauth)
- `sqlite3`: Local caching

## Security Notes

- OAuth tokens stored encrypted by auth-provider
- Cache database has 0600 permissions (user read/write only)
- No email content stored locally (only metadata cached)
- Uses Gmail API with least-privilege scope
