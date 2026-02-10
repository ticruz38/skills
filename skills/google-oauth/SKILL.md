---
name: google-oauth
description: Authenticate with Google OAuth2 to access Gmail, Calendar, Drive, Sheets, and other Google services. Use when the user needs to connect their Google account for email management, calendar events, file storage, or any Google Workspace integration. Supports seamless chat-based OAuth via minion.do.
---

# Google OAuth2 Skill

Universal Google OAuth2 integration for Gmail, Calendar, Drive, Sheets, and more.

---

## Supported Google Services

| Service | Scopes | Use Cases |
|---------|--------|-----------|
| **Gmail** | `gmail.modify`, `gmail.labels` | Read, send, manage emails |
| **Calendar** | `calendar`, `calendar.events` | Create events, check availability |
| **Drive** | `drive`, `drive.file` | Upload, download, manage files |
| **Sheets** | `spreadsheets` | Read/write spreadsheets |
| **Docs** | `documents` | Create and edit documents |
| **People** | `userinfo.profile`, `userinfo.email` | Get user profile info |

---

## Quick Start

### 1. Configure Environment

Add to your `~/.openclaw/.env`:

```bash
# Minion.do configuration (recommended)
MINION_BASE_URL=https://minion.do
MINION_API_KEY=your-api-key-if-required
OPENCLAW_INSTANCE_ID=openclaw-prod-001

# Optional: Custom redirect host for branded OAuth pages
# MINION_REDIRECT_HOST=https://your-domain.com/auth/callback
```

### 2. Connect via Chat

Simply ask in Telegram/WhatsApp:

> **You:** Connect my Google account
>
> **OpenClaw:** 🔗 **Connect your Google Account**
>
> Click this link to authorize access to Gmail, Calendar, and Drive:
> https://minion.do/auth/callback?state=abc123
>
> ⏳ Link expires in 5 minutes.
> I'll let you know once you're connected!
>
> *[User clicks and authorizes]*
>
> **OpenClaw:** ✅ **Google Account Connected!**
>
> 📧 **john@example.com**
> 
> Authorized services:
> • Gmail - Read and send emails
> • Calendar - Manage events
> • Drive - Access files
>
> You can now use Google commands like:
> • 'Show my unread emails'
> • 'What's on my calendar today?'
> • 'List files in my Drive'

---

## Service-Specific Connections

### Connect Only Gmail

> **You:** Connect Gmail only

### Connect Only Calendar

> **You:** Connect Google Calendar

### Connect Only Drive

> **You:** Connect Google Drive

### Connect Everything

> **You:** Connect all Google services

---

## Usage Examples

### Check Connection Status

> **You:** Google status

**OpenClaw:**
```
✅ Google Account Connected
📧 john@example.com

Connected services:
  ✓ Gmail
  ✓ Calendar  
  ✓ Drive

Available commands:
  • Gmail: 'Show unread emails', 'Send email...'
  • Calendar: 'What's on my calendar?', 'Create event...'
  • Drive: 'List my files', 'Upload to Drive...'
```

### Disconnect

> **You:** Disconnect Google

---

## Python API Usage

### Initialize Client

```python
from scripts.google_auth_client import GoogleAuthClient

# Check if connected
client = GoogleAuthClient.for_chat(chat_id="123456789")

if not client.is_connected():
    # Start OAuth flow
    auth_info = client.request_auth_url(
        services=["gmail", "calendar", "drive"]
    )
    print(f"Send this to user: {auth_info['authUrl']}")
    
    # Poll for completion
    client.complete_auth(auth_info['state'])
```

### Use Google Services

```python
# Gmail
from scripts.google_services import GmailService

gmail = GmailService.for_chat(chat_id="123456789")
messages = gmail.list_messages(query="is:unread", max_results=10)

# Calendar
from scripts.google_services import CalendarService

calendar = CalendarService.for_chat(chat_id="123456789")
events = calendar.list_events(time_min="2026-02-05T00:00:00Z")

# Drive
from scripts.google_services import DriveService

drive = DriveService.for_chat(chat_id="123456789")
files = drive.list_files(page_size=10)
```

---

## Scopes Reference

### Predefined Scope Sets

```python
from scripts.google_scopes import Scopes

# Gmail only
Scopes.GMAIL
# ['https://www.googleapis.com/auth/gmail.modify',
#  'https://www.googleapis.com/auth/gmail.labels']

# Calendar only
Scopes.CALENDAR
# ['https://www.googleapis.com/auth/calendar',
#  'https://www.googleapis.com/auth/calendar.events']

# Drive only
Scopes.DRIVE
# ['https://www.googleapis.com/auth/drive',
#  'https://www.googleapis.com/auth/drive.file']

# All services
Scopes.ALL
# Combines Gmail + Calendar + Drive + Sheets + Docs

# Read-only access
Scopes.GMAIL_READONLY
Scopes.CALENDAR_READONLY
Scopes.DRIVE_READONLY
```

### Custom Scopes

```python
from scripts.google_auth_client import GoogleAuthClient

client = GoogleAuthClient.for_chat(chat_id="123456789")

# Request specific scopes
auth_info = client.request_auth_url(
    scopes=[
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly"
    ]
)
```

---

## CLI Usage

### Check Status

```bash
python3 ~/.openclaw/skills/google-oauth/scripts/google_auth.py \
    --chat-id 123456789 \
    --status
```

### Connect Services

```bash
# Connect all services
python3 ~/.openclaw/skills/google-oauth/scripts/google_auth.py \
    --chat-id 123456789 \
    --platform telegram \
    --services gmail,calendar,drive

# Connect Gmail only
python3 ~/.openclaw/skills/google-oauth/scripts/google_auth.py \
    --chat-id 123456789 \
    --services gmail
```

### Disconnect

```bash
python3 ~/.openclaw/skills/google-oauth/scripts/google_auth.py \
    --chat-id 123456789 \
    --disconnect
```

### With Custom Redirect Host

```bash
python3 ~/.openclaw/skills/google-oauth/scripts/google_auth.py \
    --chat-id 123456789 \
    --services all \
    --redirect-host https://your-domain.com/auth/callback
```

---

## Token Storage

Tokens are stored securely per chat:

```
~/.openclaw/
└── google-tokens/
    ├── gmail-{chat_hash}.json
    ├── calendar-{chat_hash}.json
    ├── drive-{chat_hash}.json
    └── combined-{chat_hash}.json   # All services in one token
```

Each file has 0600 permissions (user read/write only).

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINION_BASE_URL` | Minion.do platform URL | `https://minion.do` |
| `MINION_API_KEY` | API key for minion.do | (optional) |
| `MINION_REDIRECT_HOST` | Custom OAuth redirect host | (minion.do default) |
| `OPENCLAW_INSTANCE_ID` | Unique instance identifier | `openclaw-local` |
| `GOOGLE_TOKEN_DIR` | Custom token storage path | `~/.openclaw/google-tokens` |

---

## Integration for OpenClaw Developers

```python
from scripts.google_auth_manager import GoogleAuthManager

# Initialize manager
auth = GoogleAuthManager(platform="telegram")

# Handle user requests
response = auth.handle_request(
    chat_id="123456789",
    message_text="Connect my Google account"
)

if response:
    send_message(chat_id, response["text"])
    
    # Handle background actions
    for action in response.get("actions", []):
        if action["type"] == "poll_oauth":
            # Start background polling
            start_background_task(
                auth.poll_and_complete,
                state=action["state"],
                chat_id=action["chat_id"],
                send_callback=send_message
            )
```

---

## Security Notes

- **Token Encryption:** Tokens are stored with restricted file permissions (0600)
- **No Token Logging:** Tokens never appear in logs or chat messages
- **Session Timeout:** OAuth sessions expire after 5 minutes
- **Scope Limiting:** Only request scopes you actually need
- **Automatic Refresh:** Tokens auto-refresh when expired

---

## Troubleshooting

### "Not connected" error

```bash
# Check status
python3 scripts/google_auth.py --chat-id 123456789 --status

# Reconnect
python3 scripts/google_auth.py --chat-id 123456789 --services all
```

### "Insufficient permissions" error

The user needs to grant all requested scopes. Have them:
1. Disconnect: `Disconnect Google`
2. Reconnect: `Connect all Google services`

### Token expired

Tokens auto-refresh. If issues persist:
```bash
rm ~/.openclaw/google-tokens/*-{chat_hash}.json
# Then reconnect via chat
```

---

## References

- [Gmail API](https://developers.google.com/gmail/api/reference/rest)
- [Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Drive API](https://developers.google.com/drive/api/v3/reference)
- [Sheets API](https://developers.google.com/sheets/api/reference/rest)
- [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
