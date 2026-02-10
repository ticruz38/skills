#!/usr/bin/env python3
"""
Calendar Skill - Google Calendar API wrapper
HTTP API service for calendar operations
"""

import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

app = Flask(__name__)

# Config from environment
REFRESH_TOKEN = os.environ.get('GOOGLE_REFRESH_TOKEN')
CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
CALENDAR_ID = os.environ.get('GOOGLE_CALENDAR_ID', 'primary')
PORT = int(os.environ.get('PORT', 5000))

def get_calendar_service():
    """Build calendar service from refresh token"""
    creds = Credentials(
        None,  # No access token, we'll use refresh
        refresh_token=REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET
    )
    
    # Refresh the token
    creds.refresh(Request())
    
    return build('calendar', 'v3', credentials=creds)

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        service = get_calendar_service()
        # Try to get calendar list
        service.calendarList().list(maxResults=1).execute()
        return jsonify({
            'status': 'healthy',
            'calendar': CALENDAR_ID
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/events', methods=['GET'])
def list_events():
    """List upcoming events"""
    try:
        days = int(request.args.get('days', 7))
        
        service = get_calendar_service()
        
        now = datetime.utcnow()
        time_min = now.isoformat() + 'Z'
        time_max = (now + timedelta(days=days)).isoformat() + 'Z'
        
        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        simplified = [{
            'id': e['id'],
            'summary': e.get('summary', 'No title'),
            'start': e['start'].get('dateTime', e['start'].get('date')),
            'end': e['end'].get('dateTime', e['end'].get('date'))
        } for e in events]
        
        return jsonify({'events': simplified})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/events', methods=['POST'])
def create_event():
    """Create a new event"""
    try:
        data = request.json
        
        event = {
            'summary': data.get('title', 'New Event'),
            'start': {
                'dateTime': data['start'],
                'timeZone': 'UTC'
            },
            'end': {
                'dateTime': data['end'],
                'timeZone': 'UTC'
            }
        }
        
        if 'attendees' in data:
            event['attendees'] = [{'email': e} for e in data['attendees']]
        
        service = get_calendar_service()
        created = service.events().insert(
            calendarId=CALENDAR_ID,
            body=event
        ).execute()
        
        return jsonify({
            'success': True,
            'id': created['id'],
            'link': created.get('htmlLink')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/free-slots', methods=['GET'])
def find_free_slots():
    """Find free time slots for a date"""
    try:
        date_str = request.args.get('date')
        duration = int(request.args.get('duration', 60))
        
        if not date_str:
            return jsonify({'error': 'date parameter required (YYYY-MM-DD)'}), 400
        
        # Parse date
        date = datetime.strptime(date_str, '%Y-%m-%d')
        
        # Get events for that day
        service = get_calendar_service()
        
        day_start = date.replace(hour=0, minute=0, second=0)
        day_end = date.replace(hour=23, minute=59, second=59)
        
        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=day_start.isoformat() + 'Z',
            timeMax=day_end.isoformat() + 'Z',
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Simple slot finder (9 AM to 6 PM)
        work_start = date.replace(hour=9, minute=0)
        work_end = date.replace(hour=18, minute=0)
        
        # Find free slots
        slots = []
        current = work_start
        
        for event in events:
            event_start = datetime.fromisoformat(
                event['start'].get('dateTime', event['start'].get('date')).replace('Z', '+00:00')
            )
            
            if current + timedelta(minutes=duration) <= event_start:
                slots.append(current.strftime('%H:%M'))
            
            event_end = datetime.fromisoformat(
                event['end'].get('dateTime', event['end'].get('date')).replace('Z', '+00:00')
            )
            current = max(current, event_end)
        
        # Check end of day
        if current + timedelta(minutes=duration) <= work_end:
            slots.append(current.strftime('%H:%M'))
        
        return jsonify({'slots': slots[:5]})  # Return max 5 slots
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f'[Calendar] Starting on port {PORT}')
    app.run(host='0.0.0.0', port=PORT)
