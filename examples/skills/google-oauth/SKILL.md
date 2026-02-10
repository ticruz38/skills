---
name: google-oauth
description: "Google OAuth2 for Gmail, Calendar, Drive, Sheets"
version: 1.0.0
author: ticruz38
entry: ./index.js
type: script
---

# Google OAuth Skill

Authenticate with Google services (Gmail, Calendar, Drive, Sheets) via OAuth2. Designed for chat-based agents with minion.do integration.

## Capabilities

- `auth [chat_id] [services...]` - Get OAuth URL for user to connect
  - Services: gmail, calendar, drive, sheets, docs (default: all)
  - Returns: `{ "auth_url": "...", "state": "...", "expires_in": 300 }`
  - Example: `./index.js auth 123456789 gmail calendar`

- `status [chat_id]` - Check if user is connected
  - Returns: `{ "connected": true, "email": "user@gmail.com", "services": [...] }`
  - Example: `./index.js status 123456789`

- `gmail [chat_id] [action]` - Gmail operations (list, send, search)
  - Actions: list [max], send [to] [subject] [body], search [query]
  - Returns: JSON with messages or confirmation
  - Example: `./index.js gmail 123456789 list 10`

- `calendar [chat_id] [action]` - Calendar operations
  - Actions: list [days], create [title] [start] [end], free [date] [duration]
  - Returns: JSON with events or confirmation
  - Example: `./index.js calendar 123456789 list 7`

- `drive [chat_id] [action]` - Drive operations
  - Actions: list [max], upload [path], download [fileId]
  - Returns: JSON with files or confirmation
  - Example: `./index.js drive 123456789 list 10`

- `disconnect [chat_id]` - Remove all tokens for user
  - Returns: `{ "disconnected": true }`
  - Example: `./index.js disconnect 123456789`

## Setup

1. Ensure you have a minion.do account or OAuth callback service
2. Configure environment variables (see below)
3. When user says "Connect my Google account", call: `./index.js auth <chat_id> gmail calendar drive`
4. Send the `auth_url` to user
5. Poll status: `./index.js status <chat_id>` until connected

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINION_BASE_URL` | Yes | `https://minion.do` | OAuth callback service URL |
| `MINION_API_KEY` | No | - | API key for minion.do |
| `OPENCLAW_INSTANCE_ID` | No | `openclaw-local` | Instance identifier |
| `GOOGLE_TOKEN_DIR` | No | `~/.openclaw/google-tokens` | Where tokens are stored |

## Token Storage

Tokens are stored securely per chat:
```
~/.openclaw/google-tokens/
├── combined-{hash}.json    # All services
├── gmail-{hash}.json       # Gmail only
├── calendar-{hash}.json    # Calendar only
└── drive-{hash}.json       # Drive only
```

Files have 0600 permissions (user read/write only).

## OAuth Flow

```
1. Agent: ./index.js auth 123456789 gmail
2. Skill:  Returns auth URL
3. Agent:  Send URL to user in chat
4. User:   Clicks URL, authorizes with Google
5. Google: Redirects to minion.do with code
6. Skill:  Polls and exchanges code for tokens
7. Agent:  "✅ Connected as user@gmail.com"
```

## Examples

```bash
# Check status
./index.js status 123456789

# Get Gmail messages
./index.js gmail 123456789 list 10

# Search Gmail
./index.js gmail 123456789 search "from:boss@company.com"

# List calendar events
./index.js calendar 123456789 list 7

# Find free slots
./index.js calendar 123456789 free 2026-02-15 60

# List Drive files
./index.js drive 123456789 list 20

# Disconnect
./index.js disconnect 123456789
```

## Dependencies

- Node.js >= 14
- Python 3 (for Google API scripts)
- `google-auth-client.py` and `google_services.py` in `scripts/`

## Security

- ✅ Tokens never logged to console
- ✅ 0600 file permissions
- ✅ 5-minute OAuth session timeout
- ✅ SHA-256 hashed chat IDs in filenames
- ✅ Auto-refresh expired tokens

## See Also

- [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Gmail API](https://developers.google.com/gmail/api/reference/rest)
- [Calendar API](https://developers.google.com/calendar/api/v3/reference)
