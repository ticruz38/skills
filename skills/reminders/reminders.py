#!/usr/bin/env python3
"""
Reminders Skill - Local reminder management with SQLite
No external APIs required
"""

import os
import sys
import json
import sqlite3
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from croniter import croniter

# Storage path
SKILL_DIR = Path.home() / '.openclaw' / 'skills' / 'reminders'
DB_PATH = SKILL_DIR / 'reminders.db'


def init_db():
    """Initialize SQLite database"""
    SKILL_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL,
            scheduled_at TIMESTAMP NOT NULL,
            recurring TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            snooze_until TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY,
            message TEXT,
            scheduled_at TIMESTAMP,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()


def parse_datetime(dt_string):
    """Parse various datetime formats"""
    formats = [
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%H:%M",  # Today at specific time
    ]
    
    for fmt in formats:
        try:
            result = datetime.strptime(dt_string, fmt)
            # If no date provided, use today
            if fmt == "%H:%M":
                now = datetime.now()
                result = result.replace(year=now.year, month=now.month, day=now.day)
                # If time already passed, assume tomorrow
                if result < now:
                    result += timedelta(days=1)
            return result
        except ValueError:
            continue
    
    # Try natural language parsing
    now = datetime.now()
    dt_string_lower = dt_string.lower()
    
    if dt_string_lower == 'now':
        return now
    elif dt_string_lower == 'tomorrow':
        return now + timedelta(days=1)
    elif dt_string_lower == 'in 1 hour' or dt_string_lower == 'in an hour':
        return now + timedelta(hours=1)
    elif dt_string_lower.startswith('in '):
        parts = dt_string_lower[3:].split()
        if len(parts) >= 2:
            try:
                num = int(parts[0])
                unit = parts[1]
                if 'hour' in unit:
                    return now + timedelta(hours=num)
                elif 'minute' in unit:
                    return now + timedelta(minutes=num)
                elif 'day' in unit:
                    return now + timedelta(days=num)
                elif 'week' in unit:
                    return now + timedelta(weeks=num)
            except ValueError:
                pass
    
    raise ValueError(f"Unable to parse datetime: {dt_string}")


def cmd_add(dt_string, message):
    """Add a one-time reminder"""
    try:
        scheduled_at = parse_datetime(dt_string)
    except ValueError as e:
        print(json.dumps({"error": str(e)}))
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO reminders (message, scheduled_at)
        VALUES (?, ?)
    ''', (message, scheduled_at))
    
    reminder_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(json.dumps({
        "id": reminder_id,
        "message": message,
        "scheduled_at": scheduled_at.isoformat(),
        "created": True
    }))


def cmd_recurring(schedule, message):
    """Add a recurring reminder"""
    valid_schedules = ['daily', 'weekly', 'monthly']
    
    # Validate cron expression if not simple schedule
    if schedule not in valid_schedules:
        try:
            croniter(schedule)
        except:
            print(json.dumps({
                "error": f"Invalid schedule. Use: {', '.join(valid_schedules)} or valid cron expression"
            }))
            return
    
    # Calculate first occurrence
    now = datetime.now()
    if schedule == 'daily':
        scheduled_at = now + timedelta(days=1)
    elif schedule == 'weekly':
        scheduled_at = now + timedelta(weeks=1)
    elif schedule == 'monthly':
        # Approximate
        scheduled_at = now + timedelta(days=30)
    else:
        # Cron - next occurrence
        itr = croniter(schedule, now)
        scheduled_at = itr.get_next(datetime)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO reminders (message, scheduled_at, recurring)
        VALUES (?, ?, ?)
    ''', (message, scheduled_at, schedule))
    
    reminder_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(json.dumps({
        "id": reminder_id,
        "message": message,
        "schedule": schedule,
        "next_occurrence": scheduled_at.isoformat(),
        "created": True
    }))


def cmd_list():
    """List all pending reminders"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, message, scheduled_at, recurring, created_at, snooze_until
        FROM reminders
        WHERE completed_at IS NULL
        ORDER BY scheduled_at ASC
    ''')
    
    reminders = []
    for row in cursor.fetchall():
        reminders.append({
            "id": row[0],
            "message": row[1],
            "scheduled_at": row[2],
            "recurring": row[3],
            "created_at": row[4],
            "snooze_until": row[5]
        })
    
    conn.close()
    
    print(json.dumps({"reminders": reminders, "count": len(reminders)}))


def cmd_due():
    """List reminders due now or overdue"""
    now = datetime.now()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, message, scheduled_at, recurring, snooze_until
        FROM reminders
        WHERE completed_at IS NULL
          AND (scheduled_at <= ? OR snooze_until <= ?)
        ORDER BY scheduled_at ASC
    ''', (now, now))
    
    reminders = []
    for row in cursor.fetchall():
        # Check if snoozed
        if row[4] and datetime.fromisoformat(row[4]) > now:
            continue
        
        reminders.append({
            "id": row[0],
            "message": row[1],
            "scheduled_at": row[2],
            "recurring": row[3],
            "is_overdue": datetime.fromisoformat(row[2]) < now
        })
    
    conn.close()
    
    print(json.dumps({"due": reminders, "count": len(reminders)}))


def cmd_complete(reminder_id):
    """Mark a reminder as complete"""
    now = datetime.now()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get reminder details first
    cursor.execute('SELECT message, scheduled_at, recurring FROM reminders WHERE id = ?', (reminder_id,))
    row = cursor.fetchone()
    
    if not row:
        print(json.dumps({"error": f"Reminder {reminder_id} not found"}))
        conn.close()
        return
    
    message, scheduled_at, recurring = row
    
    if recurring:
        # Calculate next occurrence
        schedule = recurring
        if schedule == 'daily':
            next_at = datetime.fromisoformat(scheduled_at) + timedelta(days=1)
        elif schedule == 'weekly':
            next_at = datetime.fromisoformat(scheduled_at) + timedelta(weeks=1)
        elif schedule == 'monthly':
            next_at = datetime.fromisoformat(scheduled_at) + timedelta(days=30)
        else:
            # Cron
            itr = croniter(schedule, datetime.fromisoformat(scheduled_at))
            next_at = itr.get_next(datetime)
        
        # Update with next occurrence
        cursor.execute('''
            UPDATE reminders
            SET scheduled_at = ?, snooze_until = NULL
            WHERE id = ?
        ''', (next_at, reminder_id))
        
        result = {
            "id": reminder_id,
            "completed": True,
            "recurring": True,
            "next_occurrence": next_at.isoformat()
        }
    else:
        # Move to history and delete
        cursor.execute('''
            INSERT INTO history (id, message, scheduled_at)
            VALUES (?, ?, ?)
        ''', (reminder_id, message, scheduled_at))
        
        cursor.execute('DELETE FROM reminders WHERE id = ?', (reminder_id,))
        
        result = {
            "id": reminder_id,
            "completed": True,
            "recurring": False
        }
    
    conn.commit()
    conn.close()
    
    print(json.dumps(result))


def cmd_snooze(reminder_id, minutes):
    """Snooze a reminder"""
    snooze_until = datetime.now() + timedelta(minutes=int(minutes))
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE reminders
        SET snooze_until = ?
        WHERE id = ? AND completed_at IS NULL
    ''', (snooze_until, reminder_id))
    
    if cursor.rowcount == 0:
        print(json.dumps({"error": f"Reminder {reminder_id} not found or already completed"}))
        conn.close()
        return
    
    conn.commit()
    conn.close()
    
    print(json.dumps({
        "id": reminder_id,
        "snoozed": True,
        "snooze_until": snooze_until.isoformat()
    }))


def cmd_delete(reminder_id):
    """Delete a reminder"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM reminders WHERE id = ?', (reminder_id,))
    
    if cursor.rowcount == 0:
        print(json.dumps({"error": f"Reminder {reminder_id} not found"}))
        conn.close()
        return
    
    conn.commit()
    conn.close()
    
    print(json.dumps({"id": reminder_id, "deleted": True}))


def cmd_daemon():
    """Run reminder checker (for cron)"""
    now = datetime.now()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, message, scheduled_at, recurring
        FROM reminders
        WHERE completed_at IS NULL
          AND scheduled_at <= ?
          AND (snooze_until IS NULL OR snooze_until <= ?)
        ORDER BY scheduled_at ASC
    ''', (now, now))
    
    due_reminders = []
    for row in cursor.fetchall():
        due_reminders.append({
            "id": row[0],
            "message": row[1],
            "scheduled_at": row[2],
            "recurring": row[3]
        })
    
    conn.close()
    
    if due_reminders:
        print(json.dumps({
            "notifications": due_reminders,
            "count": len(due_reminders),
            "timestamp": now.isoformat()
        }))
    else:
        print(json.dumps({"notifications": [], "count": 0}))


def cmd_health():
    """Check skill health"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM reminders WHERE completed_at IS NULL')
        pending = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM history')
        completed = cursor.fetchone()[0]
        
        conn.close()
        
        print(json.dumps({
            "status": "healthy",
            "pending_reminders": pending,
            "completed_reminders": completed,
            "database": str(DB_PATH)
        }))
    except Exception as e:
        print(json.dumps({"status": "unhealthy", "error": str(e)}))


def main():
    init_db()
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No command specified",
            "usage": "./reminders.py [add|recurring|list|due|complete|snooze|delete|daemon|health] [args...]"
        }))
        return
    
    cmd = sys.argv[1]
    args = sys.argv[2:]
    
    if cmd == 'add':
        if len(args) < 2:
            print(json.dumps({"error": "Usage: add [datetime] [message]"}))
            return
        cmd_add(args[0], ' '.join(args[1:]))
    elif cmd == 'recurring':
        if len(args) < 2:
            print(json.dumps({"error": "Usage: recurring [schedule] [message]"}))
            return
        cmd_recurring(args[0], ' '.join(args[1:]))
    elif cmd == 'list':
        cmd_list()
    elif cmd == 'due':
        cmd_due()
    elif cmd == 'complete':
        if not args:
            print(json.dumps({"error": "Reminder ID required"}))
            return
        cmd_complete(int(args[0]))
    elif cmd == 'snooze':
        if len(args) < 2:
            print(json.dumps({"error": "Usage: snooze [id] [minutes]"}))
            return
        cmd_snooze(int(args[0]), args[1])
    elif cmd == 'delete':
        if not args:
            print(json.dumps({"error": "Reminder ID required"}))
            return
        cmd_delete(int(args[0]))
    elif cmd == 'daemon':
        cmd_daemon()
    elif cmd == 'health':
        cmd_health()
    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))


if __name__ == '__main__':
    main()
