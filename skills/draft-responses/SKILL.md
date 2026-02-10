---
name: draft-responses
description: "Generate email reply suggestions with multiple tone options and context-aware drafting. Built on top of email skill for reading messages and sending replies."
version: 1.0.0
author: OpenClaw
entry: ./dist/cli.js
type: script
---

# Draft Responses Skill

Generate email reply suggestions with multiple tone options, context-aware drafting, and one-click sending. Built on top of the email skill for seamless Gmail integration.

## Features

- **Multiple Tone Options**: Generate replies in professional, casual, friendly, formal, enthusiastic, empathetic, authoritative, or witty tones
- **Context-Aware Drafting**: Analyzes email content (questions, urgency, thanks, meeting requests) to generate appropriate responses
- **Thread Context**: Considers previous messages in email threads for continuity
- **Template System**: Pre-built templates for common email scenarios
- **One-Click Send**: Send drafts directly after generation
- **SQLite Storage**: Tracks all generated drafts with send status

## Installation

```bash
npm install
npm run build
```

## Prerequisites

Requires the email skill to be configured:

```bash
# Connect your Google account with Gmail scope
node ../google-oauth/dist/cli.js connect default gmail
```

## CLI Usage

### Check Health

```bash
# Check system health and email skill connection
node dist/cli.js health
```

### Generate Draft Replies

```bash
# Generate drafts for an email (default tones: professional, friendly)
node dist/cli.js generate <email-id>

# Generate with specific tones
node dist/cli.js generate <email-id> --tones professional,casual

# Generate more drafts
node dist/cli.js generate <email-id> --count 4

# Generate without thread context
node dist/cli.js generate <email-id> --no-context
```

### View Drafts

```bash
# List all drafts
node dist/cli.js drafts

# List drafts for specific email
node dist/cli.js drafts <email-id>

# Limit results
node dist/cli.js drafts --limit 10
```

### Send a Draft

```bash
# Send a draft by ID
node dist/cli.js send <draft-id>
```

### Delete a Draft

```bash
# Delete a draft by ID
node dist/cli.js delete <draft-id>
```

### Use Templates

```bash
# List available templates
node dist/cli.js templates

# Filter by category
node dist/cli.js templates --category meetings

# Apply a template
node dist/cli.js template thank-you --variables '{"name":"John","reason":"your help"}'

# View available tones
node dist/cli.js tones
```

### View Statistics

```bash
# Show usage statistics
node dist/cli.js stats
```

## JavaScript/TypeScript API

### Initialize

```typescript
import { DraftResponsesSkill } from '@openclaw/draft-responses';

// Create skill for default profile
const drafts = new DraftResponsesSkill();

// Or for specific profile
const workDrafts = new DraftResponsesSkill('work');
```

### Generate Draft Replies

```typescript
// Generate drafts for an email
const drafts = await drafts.generateDrafts('email-message-id', {
  tones: ['professional', 'friendly'],
  count: 3,
  useThreadContext: true
});

for (const draft of drafts) {
  console.log(`Tone: ${draft.tone}`);
  console.log(`Draft:\n${draft.draft}`);
  console.log(`---`);
}
```

### Send a Draft

```typescript
// Send a draft by its ID
const result = await drafts.sendDraft(1);
if (result.success) {
  console.log('Sent:', result.message);
}
```

### Use Templates

```typescript
// Get a template
const template = await drafts.getTemplate('thank-you');

// Apply with variables
const response = drafts.applyTemplate(template, {
  name: 'John',
  reason: 'your help with the project'
});
console.log(response);
```

### Get Available Tones

```typescript
const tones = drafts.getAvailableTones();
// ['professional', 'casual', 'friendly', 'formal', 
//  'enthusiastic', 'empathetic', 'authoritative', 'witty']
```

### Get Draft History

```typescript
// Get drafts for a specific email
const emailDrafts = await drafts.getDraftsForEmail('email-message-id');

// Get all drafts
const allDrafts = await drafts.getAllDrafts(50);

// Get statistics
const stats = await drafts.getStats();
console.log(`Generated: ${stats.totalDrafts}, Sent: ${stats.sentDrafts}`);
```

### Health Check

```typescript
const health = await drafts.healthCheck();
if (health.status === 'healthy') {
  console.log('Ready to generate drafts');
}
```

## Available Tones

| Tone | Description |
|------|-------------|
| `professional` | Clear, business-appropriate language. Concise and respectful. |
| `casual` | Relaxed, conversational style. Uses contractions and everyday language. |
| `friendly` | Warm and approachable. Inclusive language and positive expressions. |
| `formal` | Proper grammar and sophisticated vocabulary. No contractions or slang. |
| `enthusiastic` | Shows excitement and energy. Positive adjectives. |
| `empathetic` | Shows understanding and compassion. Acknowledges feelings. |
| `authoritative` | Demonstrates expertise and confidence. Strong statements. |
| `witty` | Clever and light humor where appropriate. |

## Built-in Templates

| Template | Category | Description |
|----------|----------|-------------|
| `thank-you` | appreciation | Express gratitude |
| `acknowledgment` | general | Acknowledge receipt |
| `follow-up` | general | Follow up on conversation |
| `meeting-accept` | meetings | Accept meeting invitation |
| `meeting-decline` | meetings | Decline with alternative |
| `information-request` | general | Request more information |
| `deadline-extension` | general | Request deadline extension |
| `apology` | general | Professional apology |

## Template Variables

Templates use `{{variableName}}` syntax for substitution:

```typescript
const template = await drafts.getTemplate('thank-you');
const response = drafts.applyTemplate(template, {
  name: 'Alice',
  reason: 'the quick turnaround'
});
// Result:
// Hi Alice,
//
// Thank you so much for the quick turnaround. I really appreciate it!
//
// Best regards
```

## Content Analysis

The skill automatically analyzes incoming emails:

- **Questions**: Generates informative responses
- **Thank You Messages**: Expresses appreciation
- **Meeting Requests**: Accepts/declines professionally
- **Urgent Requests**: Prioritizes appropriately
- **General Messages**: Provides thoughtful replies

## Storage

Draft history is stored in:
```
~/.openclaw/skills/draft-responses/drafts.db
```

Tables:
- `draft_suggestions` - Generated drafts with metadata
- `response_templates` - Available templates

## Multi-Profile Support

```typescript
// Work account
const work = new DraftResponsesSkill('work');
const workDrafts = await work.generateDrafts('email-id');

// Personal account
const personal = new DraftResponsesSkill('personal');
const personalDrafts = await personal.generateDrafts('email-id');
```

## Error Handling

```typescript
try {
  const drafts = await drafts.generateDrafts('email-id');
} catch (error) {
  if (error.message.includes('Not connected')) {
    console.log('Please authenticate with google-oauth first');
  } else if (error.message.includes('Email not found')) {
    console.log('Invalid email ID');
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

# Generate drafts for an email
npm run cli -- generate <email-id>

# List templates
npm run cli -- templates
```

## Troubleshooting

### "Email skill not available"

Authenticate with google-oauth first:
```bash
node ../google-oauth/dist/cli.js connect default gmail
```

### "Email not found"

Check the email ID is correct. Use the email skill to list emails:
```bash
node ../email/dist/cli.js list
```

## Dependencies

- `@openclaw/email`: For reading emails and sending replies
- `sqlite3`: Local draft storage

## Security Notes

- Drafts stored locally in SQLite database
- Uses email skill for all Gmail API operations
- OAuth tokens managed by google-oauth skill
