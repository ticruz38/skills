---
name: calendar
description: "Google Calendar integration"
version: 1.0.0
author: ticruz38
entry: python3 calendar.py
type: api
port: 5000
health_path: /health
---

# Calendar Skill

Read and manage Google Calendar events.

## Capabilities

- `GET /events?days=7` - List upcoming events
  - Returns: `{ "events": [...] }`
  
- `POST /events` - Create new event
  - Body: `{ "title": "...", "start": "...", "end": "..." }`
  - Returns: `{ "success": true, "id": "..." }`
  
- `GET /free-slots?date=2024-01-15&duration=60` - Find free time slots
  - Returns: `{ "slots": ["09:00", "14:00"] }`

- `GET /health` - Health check
  - Returns: `{ "status": "healthy" }`

## Setup

Requires Google OAuth credentials. During onboarding, you'll authorize access to your calendar.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_REFRESH_TOKEN` | Yes | OAuth refresh token |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret |
| `GOOGLE_CALENDAR_ID` | No | Calendar ID (default: primary) |
| `PORT` | No | HTTP port (default: 5000) |

## Examples

```bash
# Start the service
python3 calendar.py

# List events
curl http://localhost:5000/events?days=7

# Create event
curl -X POST http://localhost:5000/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Meeting","start":"2024-01-15T10:00:00","end":"2024-01-15T11:00:00"}'
```
