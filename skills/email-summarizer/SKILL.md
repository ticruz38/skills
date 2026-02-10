---
title: Email Summarizer
skills:
  - email-summarizer
tags:
  - email
  - summarization
  - productivity
  - gmail
---

# Email Summarizer

Summarize long email threads with key points and action items extraction. Built on top of the email skill for Gmail integration.

## Features

- **Thread Summarization**: Extract concise summaries from long email threads
- **Key Points Extraction**: Identify the most important points from the conversation
- **Action Items Detection**: Automatically detect tasks, deadlines, and follow-ups
- **Adjustable Length**: Short, medium, or long summaries based on your needs
- **Multiple Formats**: Paragraph, bullet points, or numbered list output
- **History Tracking**: Keep a record of all generated summaries

## Installation

```bash
cd skills/email-summarizer
npm install
npm run build
```

## CLI Usage

```bash
# Summarize a thread
email-summarizer summarize <threadId>

# With options
email-summarizer summarize <threadId> --length short --format numbered

# View history
email-summarizer history

# Get specific summary
email-summarizer get <id>

# Show statistics
email-summarizer stats

# Check health
email-summarizer health
```

### Options

- `--length, -l`: Summary length - `short`, `medium`, or `long` (default: `medium`)
- `--format, -f`: Output format - `paragraph`, `bullet`, or `numbered` (default: `bullet`)
- `--no-actions`: Skip action item extraction
- `--profile, -p`: Email profile to use (default: `default`)

## API Usage

```typescript
import { EmailSummarizerSkill } from '@openclaw/email-summarizer';

const summarizer = new EmailSummarizerSkill('default');

// Summarize a thread
const summary = await summarizer.summarize({
  threadId: '123abc456def',
  length: 'medium',
  format: 'bullet',
  extractActionItems: true
});

console.log(summary.summary);
console.log(summary.keyPoints);
console.log(summary.actionItems);

// Get history
const history = await summarizer.getHistory(10);

// Get statistics
const stats = await summarizer.getStats();

await summarizer.close();
```

## How It Works

1. **Thread Retrieval**: Fetches the entire email thread using the Gmail API
2. **Text Processing**: Extracts and combines all message bodies
3. **Sentence Scoring**: Scores sentences based on:
   - Email-specific keywords (action, deadline, decided, etc.)
   - Position in message (first/last sentences weighted higher)
   - Presence of dates, times, numbers
4. **Summary Generation**: Selects top-scoring sentences and formats them
5. **Action Item Detection**: Uses pattern matching to find tasks and deadlines
6. **Storage**: Saves summaries to SQLite for future reference

## Action Item Patterns

The skill detects action items using patterns like:
- "Need to...", "Should...", "Must..."
- "Please...", "Action item:..."
- "Follow up on..."
- "Deadline is...", "By [date]..."

Action items include:
- Priority level (high/medium/low)
- Assignee (when detectable)
- Deadline (when specified)

## Data Storage

Summaries are stored in SQLite at `~/.openclaw/skills/email-summarizer/summaries.db`:

- `thread_summaries`: Thread summaries with metadata
  - Thread ID, subject, participants
  - Summary text, key points, action items
  - Length, format, creation date

## Dependencies

- `@openclaw/email`: For Gmail API access
- `sqlite3`: For local data storage

## Requirements

- Gmail account connected via `email` skill
- OAuth credentials with Gmail scope

## Error Handling

The skill handles common errors:
- Thread not found
- Empty threads
- Email skill connection issues
- Invalid thread IDs
