#!/usr/bin/env python3
"""
Email Skill - Gmail integration for OpenClaw
Uses Google OAuth and SQLite for token storage
"""

import os
import sys
import json
import sqlite3
import base64
from datetime import datetime
from pathlib import Path

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request
except ImportError:
    print(json.dumps({"error": "Missing dependencies. Run: pip install -r requirements.txt"}))
    sys.exit(1)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

# Storage paths
SKILL_DIR = Path.home() / '.openclaw' / 'skills' / 'email'
DB_PATH = SKILL_DIR / 'email.db'
TOKEN_PATH = SKILL_DIR / 'token.json'


def init_db():
    """Initialize SQLite database"""
    SKILL_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY,
            client_id TEXT,
            client_secret TEXT,
            refresh_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS email_cache (
            message_id TEXT PRIMARY KEY,
            thread_id TEXT,
            subject TEXT,
            sender TEXT,
            snippet TEXT,
            date TIMESTAMP,
            labels TEXT,
            cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sent_log (
            id INTEGER PRIMARY KEY,
            message_id TEXT,
            to_addr TEXT,
            subject TEXT,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()


def save_credentials(client_id, client_secret, refresh_token):
    """Save OAuth credentials to database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tokens')
    cursor.execute('''
        INSERT INTO tokens (client_id, client_secret, refresh_token)
        VALUES (?, ?, ?)
    ''', (client_id, client_secret, refresh_token))
    conn.commit()
    conn.close()


def load_credentials():
    """Load OAuth credentials from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT client_id, client_secret, refresh_token FROM tokens LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {'client_id': row[0], 'client_secret': row[1], 'refresh_token': row[2]}
    return None


def get_gmail_service():
    """Get authenticated Gmail API service"""
    creds_data = load_credentials()
    
    if not creds_data:
        return None, "No credentials found. Run: ./email.py auth"
    
    creds = Credentials(
        token=None,
        refresh_token=creds_data['refresh_token'],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=creds_data['client_id'],
        client_secret=creds_data['client_secret'],
        scopes=SCOPES
    )
    
    # Refresh if needed
    if not creds.valid:
        try:
            creds.refresh(Request())
        except Exception as e:
            return None, f"Failed to refresh token: {str(e)}"
    
    service = build('gmail', 'v1', credentials=creds)
    return service, None


def cmd_auth():
    """Authenticate with Google OAuth"""
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        print(json.dumps({
            "error": "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables",
            "hint": "Set these from your Google Cloud Console OAuth credentials"
        }))
        return
    
    # Create client secrets dict for flow
    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"]
        }
    }
    
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0)
    
    save_credentials(client_id, client_secret, creds.refresh_token)
    
    print(json.dumps({
        "success": True,
        "message": "Authentication successful. You can now use email commands."
    }))


def cmd_list(max_results=10):
    """List recent emails"""
    service, error = get_gmail_service()
    if error:
        print(json.dumps({"error": error}))
        return
    
    try:
        results = service.users().messages().list(
            userId='me',
            maxResults=int(max_results)
        ).execute()
        
        messages = results.get('messages', [])
        emails = []
        
        for msg in messages:
            msg_data = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='metadata',
                metadataHeaders=['Subject', 'From', 'Date']
            ).execute()
            
            headers = msg_data.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
            
            emails.append({
                "id": msg['id'],
                "thread_id": msg_data.get('threadId'),
                "subject": subject,
                "sender": sender,
                "snippet": msg_data.get('snippet', ''),
                "date": date,
                "labels": msg_data.get('labelIds', [])
            })
        
        print(json.dumps({"emails": emails}, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))


def cmd_search(query, max_results=10):
    """Search emails"""
    service, error = get_gmail_service()
    if error:
        print(json.dumps({"error": error}))
        return
    
    try:
        results = service.users().messages().list(
            userId='me',
            q=query,
            maxResults=int(max_results)
        ).execute()
        
        messages = results.get('messages', [])
        emails = []
        
        for msg in messages:
            msg_data = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='metadata',
                metadataHeaders=['Subject', 'From', 'Date']
            ).execute()
            
            headers = msg_data.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
            
            emails.append({
                "id": msg['id'],
                "thread_id": msg_data.get('threadId'),
                "subject": subject,
                "sender": sender,
                "snippet": msg_data.get('snippet', ''),
                "date": date
            })
        
        print(json.dumps({"emails": emails, "query": query}, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))


def cmd_read(message_id):
    """Read full email content"""
    service, error = get_gmail_service()
    if error:
        print(json.dumps({"error": error}))
        return
    
    try:
        msg_data = service.users().messages().get(
            userId='me',
            id=message_id,
            format='full'
        ).execute()
        
        headers = msg_data.get('payload', {}).get('headers', [])
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
        sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
        to = next((h['value'] for h in headers if h['name'] == 'To'), '')
        date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
        
        # Extract body
        body_text = ""
        body_html = ""
        
        def get_body(parts):
            nonlocal body_text, body_html
            for part in parts:
                if part.get('mimeType') == 'text/plain' and 'data' in part.get('body', {}):
                    body_text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                elif part.get('mimeType') == 'text/html' and 'data' in part.get('body', {}):
                    body_html = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                elif part.get('parts'):
                    get_body(part['parts'])
        
        payload = msg_data.get('payload', {})
        if payload.get('parts'):
            get_body(payload['parts'])
        elif 'body' in payload and 'data' in payload['body']:
            body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
        
        result = {
            "id": message_id,
            "thread_id": msg_data.get('threadId'),
            "subject": subject,
            "from": sender,
            "to": to,
            "date": date,
            "body_text": body_text[:5000] if body_text else "",
            "body_html": body_html[:5000] if body_html else "",
            "labels": msg_data.get('labelIds', [])
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))


def cmd_send(to_addr, subject, body):
    """Send an email"""
    service, error = get_gmail_service()
    if error:
        print(json.dumps({"error": error}))
        return
    
    try:
        message = f"To: {to_addr}\nSubject: {subject}\n\n{body}"
        raw_message = base64.urlsafe_b64encode(message.encode('utf-8')).decode('utf-8')
        
        message_body = {'raw': raw_message}
        sent = service.users().messages().send(userId='me', body=message_body).execute()
        
        # Log to database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO sent_log (message_id, to_addr, subject)
            VALUES (?, ?, ?)
        ''', (sent['id'], to_addr, subject))
        conn.commit()
        conn.close()
        
        print(json.dumps({
            "success": True,
            "message_id": sent['id'],
            "to": to_addr,
            "subject": subject
        }))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))


def cmd_threads(thread_id):
    """Get all messages in a thread"""
    service, error = get_gmail_service()
    if error:
        print(json.dumps({"error": error}))
        return
    
    try:
        thread = service.users().threads().get(userId='me', id=thread_id).execute()
        messages = []
        
        for msg in thread.get('messages', []):
            headers = msg.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
            date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
            
            messages.append({
                "id": msg['id'],
                "subject": subject,
                "from": sender,
                "date": date,
                "snippet": msg.get('snippet', '')
            })
        
        print(json.dumps({
            "thread_id": thread_id,
            "messages": messages
        }, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))


def cmd_health():
    """Check skill health"""
    creds = load_credentials()
    if not creds:
        print(json.dumps({"status": "unhealthy", "error": "Not authenticated"}))
        return
    
    service, error = get_gmail_service()
    if error:
        print(json.dumps({"status": "unhealthy", "error": error}))
        return
    
    try:
        profile = service.users().getProfile(userId='me').execute()
        print(json.dumps({
            "status": "healthy",
            "email": profile.get('emailAddress'),
            "messages_total": profile.get('messagesTotal'),
            "threads_total": profile.get('threadsTotal')
        }))
    except Exception as e:
        print(json.dumps({"status": "unhealthy", "error": str(e)}))


def main():
    init_db()
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No command specified",
            "usage": "./email.py [auth|list|search|read|send|threads|health] [args...]"
        }))
        return
    
    cmd = sys.argv[1]
    args = sys.argv[2:]
    
    if cmd == 'auth':
        cmd_auth()
    elif cmd == 'list':
        cmd_list(args[0] if args else 10)
    elif cmd == 'search':
        if not args:
            print(json.dumps({"error": "Search query required"}))
            return
        cmd_search(args[0], args[1] if len(args) > 1 else 10)
    elif cmd == 'read':
        if not args:
            print(json.dumps({"error": "Message ID required"}))
            return
        cmd_read(args[0])
    elif cmd == 'send':
        if len(args) < 3:
            print(json.dumps({"error": "Usage: send [to] [subject] [body]"}))
            return
        cmd_send(args[0], args[1], args[2])
    elif cmd == 'threads':
        if not args:
            print(json.dumps({"error": "Thread ID required"}))
            return
        cmd_threads(args[0])
    elif cmd == 'health':
        cmd_health()
    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))


if __name__ == '__main__':
    main()
