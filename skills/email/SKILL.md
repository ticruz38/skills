---
name: email
description: "Gmail integration for reading, sending, and managing emails"
version: 1.0.0
author: ticruz38
entry: ./email.py
type: script
---

# Email Skill

Gmail integration for reading, sending, and managing emails through your agent.

## Capabilities

- `list [max_results]` - List recent emails
  - Returns: JSON array of emails with id, subject, sender, snippet, date
  - Example: `./email.py list 10`

- `search [query]` - Search emails with Gmail query syntax
  - Returns: Matching emails
  - Example: `./email.py search "from:boss@company.com is:unread"`

- `read [message_id]` - Read full email content
  - Returns: Full email with body (text and HTML)
  - Example: `./email.py read 123abc456`

- `send [to] [subject] [body]` - Send an email
  - Returns: Sent message confirmation
  - Example: `./email.py send "client@example.com" "Meeting notes" "Here are the notes..."`

- `threads [thread_id]` - Get all messages in a thread
  - Returns: Thread with all messages
  - Example: `./email.py threads 123abc456`

## Setup

Requires Google OAuth credentials:
1. Go to https://console.cloud.google.com/
2. Create a project and enable Gmail API
3. Create OAuth 2.0 credentials (Desktop application)
4. Download client secrets JSON

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Yes | OAuth refresh token (obtained via auth flow) |

## Authentication

First run will prompt for OAuth authorization:
```bash
./email.py auth
```

This will:
1. Open browser for Google authorization
2. Request Gmail permissions
3. Store refresh token in SQLite database
4. Use refresh token for subsequent calls

## Storage

SQLite database at `~/.openclaw/skills/email/email.db`:
- `tokens` - OAuth tokens
- `cache` - Cached email metadata
- `sent` - Sent email log
