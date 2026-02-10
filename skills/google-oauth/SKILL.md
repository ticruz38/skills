---
name: google-oauth
description: "Google OAuth adapter for Gmail, Calendar, Drive, Sheets, and other Google services. Built on top of auth-provider for secure token management with automatic refresh, multi-profile support, and health checks."
version: 1.0.0
author: OpenClaw
entry: ./dist/cli.js
type: script
---

# Google OAuth Skill

Google OAuth 2.0 integration for accessing Google services. This skill provides a simplified interface built on top of the auth-provider skill, handling authentication, token storage, automatic refresh, and health monitoring.

## Features

- **Multi-Service Support**: Gmail, Calendar, Drive, Sheets, Docs, and People
- **Multi-Profile**: Manage multiple Google accounts
- **Auto-Refresh**: Tokens automatically refresh before expiration
- **Health Checks**: Monitor token validity and expiration
- **Service Scopes**: Request only the permissions you need

## Installation

```bash
npm install
npm run build
```

## Environment Configuration

The Google OAuth skill uses the auth-provider skill's configuration. Ensure you have set up the auth-provider environment:

```bash
# ~/.openclaw/.env

# Google OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/callback

# Optional: Custom encryption key
AUTH_PROVIDER_KEY=your-encryption-key-min-32-chars
```

## CLI Usage

### Check Status

```bash
# Check default profile
node dist/cli.js status

# Check specific profile
node dist/cli.js status work
```

### Connect Account

```bash
# Connect with all services
node dist/cli.js connect default all

# Connect with specific services
node dist/cli.js connect default gmail
node dist/cli.js connect default gmail,calendar
node dist/cli.js connect default calendar,drive
```

### Complete OAuth Flow

After opening the authorization URL and granting permission:

```bash
node dist/cli.js complete default "AUTH_CODE" "STATE"
```

### List Profiles

```bash
node dist/cli.js profiles
```

### Health Check

```bash
# Check specific profile
node dist/cli.js health default

# Check all profiles
node dist/cli.js health
```

### Disconnect

```bash
# Disconnect specific profile
node dist/cli.js disconnect default

# Disconnect all profiles
node dist/cli.js disconnect
```

### View Available Scopes

```bash
node dist/cli.js scopes
```

## JavaScript/TypeScript API

### Initialize Client

```typescript
import { GoogleOAuthClient, GoogleScopes } from './index';

// Create client for default profile
const client = new GoogleOAuthClient();

// Or for specific profile
const workClient = GoogleOAuthClient.forProfile('work');
const personalClient = GoogleOAuthClient.forProfile('personal');
```

### OAuth Flow

```typescript
// Step 1: Initiate authorization
const auth = client.initiateAuth(['gmail', 'calendar', 'drive']);

console.log('Open this URL:', auth.url);
console.log('State:', auth.state); // Save for step 2

// Step 2: Complete with authorization code
const result = await client.completeAuth(code, state);

if (result.success) {
  console.log('Connected as:', result.email);
  console.log('Scopes:', result.scopes);
} else {
  console.error('Failed:', result.error);
}
```

### Check Connection Status

```typescript
if (client.isConnected()) {
  console.log('Connected!');
  
  // Get user info
  const email = await client.getUserEmail();
  const profile = await client.getUserProfile();
  console.log('Email:', email);
  console.log('Name:', profile?.name);
  console.log('Picture:', profile?.picture);
} else {
  console.log('Not connected');
}
```

### Get Access Token

```typescript
// Gets valid token (auto-refreshes if needed)
const token = await client.getAccessToken();

// Use with Google APIs
const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Check Authorized Services

```typescript
// Check if specific service is authorized
if (client.hasService('gmail')) {
  console.log('Gmail access granted');
}

if (client.hasService('calendar')) {
  console.log('Calendar access granted');
}

// Get all connected scopes
const scopes = client.getConnectedScopes();
```

### Health Check

```typescript
const health = await client.healthCheck();

if (health.status === 'healthy') {
  console.log('Token is valid');
  console.log('Expires at:', new Date(health.expiresAt! * 1000));
} else {
  console.warn('Token issue:', health.message);
}
```

### Disconnect

```typescript
// Disconnect specific profile
client.disconnect();

// Or disconnect all profiles
import { disconnectAll } from './index';
disconnectAll();
```

### Make Authenticated Requests

```typescript
// Convenient method for authenticated requests
const response = await client.fetch('https://www.googleapis.com/gmail/v1/users/me/messages');
const data = await response.json();
```

## Scope Reference

### Available Services

| Service | Scopes | Description |
|---------|--------|-------------|
| `gmail` | `gmail.modify`, `gmail.labels` | Read, send, manage emails |
| `calendar` | `calendar`, `calendar.events` | Create events, check availability |
| `drive` | `drive`, `drive.file` | Upload, download, manage files |
| `sheets` | `spreadsheets` | Read/write spreadsheets |
| `docs` | `documents` | Create and edit documents |
| `people` | `userinfo.profile`, `userinfo.email` | Get user profile info |
| `all` | All above | Full access to all services |

### Using Scopes in Code

```typescript
import { GoogleScopes, getScopesForServices } from './index';

// Predefined scope sets
console.log(GoogleScopes.GMAIL);
console.log(GoogleScopes.CALENDAR);
console.log(GoogleScopes.DRIVE);
console.log(GoogleScopes.ALL);

// Get scopes for services
const scopes = getScopesForServices(['gmail', 'calendar']);
```

## Multi-Profile Support

Manage multiple Google accounts:

```typescript
import { GoogleOAuthClient, getConnectedProfiles } from './index';

// Different profiles for different accounts
const work = GoogleOAuthClient.forProfile('work');
const personal = GoogleOAuthClient.forProfile('personal');

// Connect both
work.initiateAuth(['gmail', 'calendar']);
personal.initiateAuth(['drive']);

// List all connected profiles
const profiles = getConnectedProfiles();
console.log('Connected profiles:', profiles);

// Check each profile's health
for (const profileName of profiles) {
  const client = GoogleOAuthClient.forProfile(profileName);
  const health = await client.healthCheck();
  console.log(`${profileName}: ${health.status}`);
}
```

## Using with Google APIs

### Gmail API

```typescript
const client = GoogleOAuthClient.forProfile('default');
const token = await client.getAccessToken();

// List labels
const response = await client.fetch(
  'https://www.googleapis.com/gmail/v1/users/me/labels'
);
const labels = await response.json();

// List messages
const messagesResponse = await client.fetch(
  'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10'
);
const messages = await messagesResponse.json();
```

### Calendar API

```typescript
// List calendars
const response = await client.fetch(
  'https://www.googleapis.com/calendar/v3/users/me/calendarList'
);
const calendars = await response.json();

// List events
const now = new Date().toISOString();
const eventsResponse = await client.fetch(
  `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=10`
);
const events = await eventsResponse.json();
```

### Drive API

```typescript
// List files
const response = await client.fetch(
  'https://www.googleapis.com/drive/v3/files?pageSize=10'
);
const files = await response.json();
```

## Error Handling

```typescript
try {
  const token = await client.getAccessToken();
  if (!token) {
    console.log('Not authenticated');
    return;
  }
  
  // Make API request
  const response = await client.fetch('https://www.googleapis.com/...');
  
  if (!response.ok) {
    if (response.status === 403) {
      console.error('Permission denied - check scopes');
    } else if (response.status === 401) {
      console.error('Token expired - will auto-refresh on next call');
    }
  }
} catch (error) {
  console.error('Request failed:', error.message);
}
```

## Storage

Tokens are securely stored by the auth-provider skill in:
```
~/.openclaw/skills/auth-provider/credentials.db
```

All sensitive data is AES-256 encrypted.

## Testing

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Run CLI commands
npm run cli -- status
npm run cli -- connect default gmail
npm run status  # shortcut
```

## Troubleshooting

### "Not authenticated" error

The user needs to connect their Google account:
```bash
node dist/cli.js connect default all
```

### "Insufficient permissions" error

The connected account doesn't have the required scopes. Reconnect with the needed services:
```bash
node dist/cli.js disconnect default
node dist/cli.js connect default gmail,calendar,drive
```

### Token expired

Tokens auto-refresh when calling `getAccessToken()` or `fetch()`. If issues persist, check health:
```bash
node dist/cli.js health
```

### Connection issues

Check your Google OAuth credentials in `~/.openclaw/.env`:
```bash
# Verify auth-provider environment
node ../auth-provider/dist/cli.js env-check
```

## Dependencies

- `@openclaw/auth-provider`: For OAuth flow and token storage
- `sqlite3`: Database access (via auth-provider)

## Security Notes

- Tokens are stored encrypted by auth-provider
- OAuth uses PKCE flow for security
- Tokens auto-refresh 5 minutes before expiration
- Database file has 0600 permissions (user read/write only)
