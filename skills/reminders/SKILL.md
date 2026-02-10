---
name: reminders
description: "Set and manage reminders with notifications"
version: 1.0.0
author: ticruz38
entry: ./reminders.py
type: script
---

# Reminders Skill

Set and manage one-time or recurring reminders. Stores all data locally in SQLite.

## Capabilities

- `add [datetime] [message]` - Add a one-time reminder
  - Returns: Reminder ID and confirmation
  - Example: `./reminders.py add "2026-02-15 14:00" "Call dentist"`

- `recurring [schedule] [message]` - Add a recurring reminder
  - Schedule: daily, weekly, monthly, or cron expression
  - Returns: Reminder ID and confirmation
  - Example: `./reminders.py recurring daily "Take vitamins"`

- `list` - List all pending reminders
  - Returns: JSON array of reminders
  - Example: `./reminders.py list`

- `due` - List reminders due now or overdue
  - Returns: Reminders that need attention
  - Example: `./reminders.py due`

- `complete [id]` - Mark a reminder as complete
  - Returns: Confirmation
  - Example: `./reminders.py complete 123`

- `snooze [id] [minutes]` - Snooze a reminder
  - Returns: New scheduled time
  - Example: `./reminders.py snooze 123 30`

- `delete [id]` - Delete a reminder
  - Returns: Confirmation
  - Example: `./reminders.py delete 123`

- `daemon` - Run reminder checker (for cron/systemd)
  - Checks for due reminders and outputs notifications
  - Example: `./reminders.py daemon`

## Setup

No external API needed. All data stored locally in SQLite.

For notifications, set environment variables:
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for Telegram
- Or integrate with your agent's notification system

## Storage

SQLite database at `~/.openclaw/skills/reminders/reminders.db`:
- `reminders` - All reminders with schedule info
- `history` - Completed reminders log
