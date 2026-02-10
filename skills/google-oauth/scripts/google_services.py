#!/usr/bin/env python3
"""
Google Services API
High-level interfaces for Gmail, Calendar, Drive, and other Google services.
Uses tokens obtained via the GoogleAuthClient.
"""

import os
import sys
import json
import base64
import mimetypes
from pathlib import Path
from typing import Dict, Any, Optional, List, Iterator
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload
    HAS_GOOGLE_LIBS = True
except ImportError:
    HAS_GOOGLE_LIBS = False

from google_auth_client import GoogleAuthClient, DEFAULT_TOKEN_DIR


class GoogleServiceBase:
    """Base class for Google service wrappers."""
    
    SERVICE_NAME = ""
    API_VERSION = ""
    SCOPE_SERVICE = ""
    
    def __init__(
        self,
        chat_id: str,
        chat_platform: str = "telegram",
        token_dir: Path = DEFAULT_TOKEN_DIR
    ):
        if not HAS_GOOGLE_LIBS:
            raise ImportError(
                "Google API libraries required. "
                "Install: pip install google-auth google-auth-oauthlib "
                "google-auth-httplib2 google-api-python-client"
            )
        
        self.chat_id = chat_id
        self.chat_platform = chat_platform
        self.token_dir = token_dir
        self._service = None
        self._credentials = None
    
    @classmethod
    def for_chat(cls, chat_id: str, chat_platform: str = "telegram", **kwargs):
        """Create service instance for a chat."""
        return cls(chat_id, chat_platform, **kwargs)
    
    def _load_credentials(self) -> Optional[Credentials]:
        """Load credentials from stored tokens."""
        client = GoogleAuthClient(
            self.chat_id,
            self.chat_platform,
            token_dir=self.token_dir
        )
        
        token_data = client.get_token_for_service("combined")
        if not token_data:
            # Try service-specific token
            token_data = client.get_token_for_service(self.SCOPE_SERVICE)
        
        if not token_data:
            raise AuthenticationError(
                f"Not authenticated. Run OAuth flow first."
            )
        
        # Create credentials
        creds = Credentials.from_authorized_user_info(token_data)
        
        # Refresh if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save refreshed token
            self._save_refreshed_token(creds)
        
        return creds
    
    def _save_refreshed_token(self, creds: Credentials):
        """Save refreshed token back to storage."""
        client = GoogleAuthClient(
            self.chat_id,
            self.chat_platform,
            token_dir=self.token_dir
        )
        
        # Get existing data
        data = client.load_tokens("combined") or client.load_tokens(self.SCOPE_SERVICE)
        if data:
            data["token_data"]["token"] = creds.token
            
            # Save back
            token_path = client._get_token_path("combined")
            if not token_path.exists():
                token_path = client._get_token_path(self.SCOPE_SERVICE)
            
            with open(token_path, "w") as f:
                json.dump(data, f, indent=2)
    
    def _get_service(self):
        """Get or create service instance."""
        if self._service is None:
            creds = self._load_credentials()
            self._service = build(
                self.SERVICE_NAME,
                self.API_VERSION,
                credentials=creds,
                cache_discovery=False
            )
        return self._service
    
    @property
    def service(self):
        """Get the Google API service instance."""
        return self._get_service()


class AuthenticationError(Exception):
    """Authentication required or failed."""
    pass


# ============================================================================
# GMAIL SERVICE
# ============================================================================

class GmailService(GoogleServiceBase):
    """Gmail API wrapper."""
    
    SERVICE_NAME = "gmail"
    API_VERSION = "v1"
    SCOPE_SERVICE = "gmail"
    
    def list_messages(
        self,
        query: str = "",
        max_results: int = 100,
        label_ids: Optional[List[str]] = None
    ) -> List[Dict]:
        """List messages matching query."""
        results = []
        page_token = None
        
        while len(results) < max_results:
            params = {
                'userId': 'me',
                'maxResults': min(max_results - len(results), 100),
                'q': query
            }
            if label_ids:
                params['labelIds'] = label_ids
            if page_token:
                params['pageToken'] = page_token
            
            try:
                response = self.service.users().messages().list(**params).execute()
                messages = response.get('messages', [])
                results.extend(messages)
                
                page_token = response.get('nextPageToken')
                if not page_token or not messages:
                    break
            except HttpError as e:
                print(f"Error listing messages: {e}")
                break
        
        return results[:max_results]
    
    def get_message(self, msg_id: str, format: str = 'full') -> Dict:
        """Get full message details."""
        try:
            message = self.service.users().messages().get(
                userId='me', id=msg_id, format=format
            ).execute()
            return self._parse_message(message)
        except HttpError as e:
            raise Exception(f"Failed to get message {msg_id}: {e}")
    
    def _parse_message(self, message: Dict) -> Dict:
        """Parse raw message into structured format."""
        headers = {h['name'].lower(): h['value'] 
                   for h in message['payload'].get('headers', [])}
        
        result = {
            'id': message['id'],
            'thread_id': message.get('threadId'),
            'label_ids': message.get('labelIds', []),
            'snippet': message.get('snippet', ''),
            'subject': headers.get('subject', ''),
            'from': headers.get('from', ''),
            'to': headers.get('to', ''),
            'cc': headers.get('cc', ''),
            'bcc': headers.get('bcc', ''),
            'date': headers.get('date', ''),
            'body': '',
            'html_body': '',
            'attachments': []
        }
        
        self._extract_parts(message['payload'], result)
        return result
    
    def _extract_parts(self, part: Dict, result: Dict):
        """Recursively extract body and attachments."""
        mime_type = part.get('mimeType', '')
        body = part.get('body', {})
        
        if mime_type == 'text/plain' and 'data' in body:
            data = base64.urlsafe_b64decode(body['data']).decode('utf-8', errors='replace')
            result['body'] = data
        elif mime_type == 'text/html' and 'data' in body:
            data = base64.urlsafe_b64decode(body['data']).decode('utf-8', errors='replace')
            result['html_body'] = data
        elif 'attachmentId' in body:
            result['attachments'].append({
                'id': body['attachmentId'],
                'filename': part.get('filename', 'unnamed'),
                'mime_type': mime_type,
                'size': body.get('size', 0)
            })
        
        if 'parts' in part:
            for subpart in part['parts']:
                self._extract_parts(subpart, result)
    
    def send_message(
        self,
        to: str,
        subject: str,
        body: str = '',
        html_body: Optional[str] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        attachments: Optional[List[str]] = None
    ) -> Dict:
        """Send an email."""
        if html_body or attachments:
            msg = MIMEMultipart('mixed')
            msg['To'] = to
            msg['Subject'] = subject
            if cc:
                msg['Cc'] = cc
            if bcc:
                msg['Bcc'] = bcc
            
            if html_body:
                msg_body = MIMEMultipart('alternative')
                msg_body.attach(MIMEText(body, 'plain'))
                msg_body.attach(MIMEText(html_body, 'html'))
                msg.attach(msg_body)
            else:
                msg.attach(MIMEText(body, 'plain'))
            
            if attachments:
                for filepath in attachments:
                    self._attach_file(msg, filepath)
        else:
            msg = MIMEText(body)
            msg['To'] = to
            msg['Subject'] = subject
            if cc:
                msg['Cc'] = cc
            if bcc:
                msg['Bcc'] = bcc
        
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        
        try:
            return self.service.users().messages().send(
                userId='me', body={'raw': raw}
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to send message: {e}")
    
    def _attach_file(self, msg: MIMEMultipart, filepath: str):
        """Attach a file to message."""
        path = Path(filepath)
        if not path.exists():
            print(f"Warning: Attachment not found: {filepath}")
            return
        
        mime_type, _ = mimetypes.guess_type(str(path))
        if mime_type is None:
            mime_type = 'application/octet-stream'
        
        main_type, sub_type = mime_type.split('/', 1)
        
        with open(path, 'rb') as f:
            file_data = f.read()
        
        attachment = MIMEBase(main_type, sub_type)
        attachment.set_payload(file_data)
        encoders.encode_base64(attachment)
        attachment.add_header(
            'Content-Disposition',
            f'attachment; filename="{path.name}"'
        )
        msg.attach(attachment)
    
    def download_attachments(self, msg_id: str, output_dir: str = '.') -> List[str]:
        """Download all attachments from a message."""
        message = self.get_message(msg_id)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        downloaded = []
        for att in message.get('attachments', []):
            try:
                attachment = self.service.users().messages().attachments().get(
                    userId='me', messageId=msg_id, id=att['id']
                ).execute()
                
                data = base64.urlsafe_b64decode(attachment['data'])
                filepath = output_path / att['filename']
                
                with open(filepath, 'wb') as f:
                    f.write(data)
                
                downloaded.append(str(filepath))
            except Exception as e:
                print(f"Failed to download {att['filename']}: {e}")
        
        return downloaded
    
    def modify_labels(
        self,
        msg_id: str,
        add_labels: Optional[List[str]] = None,
        remove_labels: Optional[List[str]] = None
    ) -> Dict:
        """Add/remove labels from message."""
        body = {}
        if add_labels:
            body['addLabelIds'] = add_labels
        if remove_labels:
            body['removeLabelIds'] = remove_labels
        
        try:
            return self.service.users().messages().modify(
                userId='me', id=msg_id, body=body
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to modify labels: {e}")
    
    def archive(self, msg_id: str) -> Dict:
        """Archive message (remove from INBOX)."""
        return self.modify_labels(msg_id, remove_labels=['INBOX'])
    
    def trash(self, msg_id: str) -> Dict:
        """Move message to trash."""
        try:
            return self.service.users().messages().trash(
                userId='me', id=msg_id
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to trash message: {e}")
    
    def list_labels(self) -> List[Dict]:
        """List all labels."""
        try:
            results = self.service.users().labels().list(userId='me').execute()
            return results.get('labels', [])
        except HttpError as e:
            raise Exception(f"Failed to list labels: {e}")


# ============================================================================
# CALENDAR SERVICE
# ============================================================================

class CalendarService(GoogleServiceBase):
    """Google Calendar API wrapper."""
    
    SERVICE_NAME = "calendar"
    API_VERSION = "v3"
    SCOPE_SERVICE = "calendar"
    
    def list_calendars(self) -> List[Dict]:
        """List user's calendars."""
        try:
            results = self.service.calendarList().list().execute()
            return results.get('items', [])
        except HttpError as e:
            raise Exception(f"Failed to list calendars: {e}")
    
    def list_events(
        self,
        calendar_id: str = 'primary',
        time_min: Optional[str] = None,
        time_max: Optional[str] = None,
        max_results: int = 10,
        query: Optional[str] = None
    ) -> List[Dict]:
        """List calendar events."""
        if time_min is None:
            time_min = datetime.utcnow().isoformat() + 'Z'
        
        params = {
            'calendarId': calendar_id,
            'timeMin': time_min,
            'maxResults': max_results,
            'singleEvents': True,
            'orderBy': 'startTime'
        }
        
        if time_max:
            params['timeMax'] = time_max
        if query:
            params['q'] = query
        
        try:
            results = self.service.events().list(**params).execute()
            return results.get('items', [])
        except HttpError as e:
            raise Exception(f"Failed to list events: {e}")
    
    def create_event(
        self,
        summary: str,
        start_time: str,
        end_time: str,
        calendar_id: str = 'primary',
        description: Optional[str] = None,
        location: Optional[str] = None,
        attendees: Optional[List[str]] = None,
        timezone: str = 'UTC'
    ) -> Dict:
        """
        Create a calendar event.
        
        Args:
            summary: Event title
            start_time: ISO format datetime (e.g., "2026-02-05T14:00:00")
            end_time: ISO format datetime
            calendar_id: Calendar ID (default: 'primary')
            description: Event description
            location: Event location
            attendees: List of attendee emails
            timezone: Timezone (default: 'UTC')
        """
        event_body = {
            'summary': summary,
            'start': {
                'dateTime': start_time,
                'timeZone': timezone
            },
            'end': {
                'dateTime': end_time,
                'timeZone': timezone
            }
        }
        
        if description:
            event_body['description'] = description
        if location:
            event_body['location'] = location
        if attendees:
            event_body['attendees'] = [{'email': e} for e in attendees]
        
        try:
            return self.service.events().insert(
                calendarId=calendar_id,
                body=event_body
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to create event: {e}")
    
    def delete_event(self, event_id: str, calendar_id: str = 'primary'):
        """Delete a calendar event."""
        try:
            self.service.events().delete(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to delete event: {e}")
    
    def get_free_busy(
        self,
        time_min: str,
        time_max: str,
        calendar_ids: Optional[List[str]] = None
    ) -> Dict:
        """Get free/busy information."""
        if calendar_ids is None:
            calendar_ids = ['primary']
        
        body = {
            'timeMin': time_min,
            'timeMax': time_max,
            'items': [{'id': cid} for cid in calendar_ids]
        }
        
        try:
            return self.service.freebusy().query(body=body).execute()
        except HttpError as e:
            raise Exception(f"Failed to get free/busy: {e}")


# ============================================================================
# DRIVE SERVICE
# ============================================================================

class DriveService(GoogleServiceBase):
    """Google Drive API wrapper."""
    
    SERVICE_NAME = "drive"
    API_VERSION = "v3"
    SCOPE_SERVICE = "drive"
    
    def list_files(
        self,
        page_size: int = 10,
        query: Optional[str] = None,
        order_by: str = 'modifiedTime desc'
    ) -> List[Dict]:
        """List files in Drive."""
        params = {
            'pageSize': page_size,
            'fields': 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
            'orderBy': order_by
        }
        
        if query:
            params['q'] = query
        
        try:
            results = self.service.files().list(**params).execute()
            return results.get('files', [])
        except HttpError as e:
            raise Exception(f"Failed to list files: {e}")
    
    def upload_file(
        self,
        filepath: str,
        folder_id: Optional[str] = None,
        mime_type: Optional[str] = None
    ) -> Dict:
        """Upload a file to Drive."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        
        if mime_type is None:
            mime_type, _ = mimetypes.guess_type(str(path))
            if mime_type is None:
                mime_type = 'application/octet-stream'
        
        file_metadata = {'name': path.name}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        media = MediaFileUpload(str(path), mimetype=mime_type)
        
        try:
            return self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, mimeType, webViewLink'
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to upload file: {e}")
    
    def download_file(self, file_id: str, output_path: str) -> str:
        """Download a file from Drive."""
        try:
            request = self.service.files().get_media(fileId=file_id)
            
            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output, 'wb') as f:
                downloader = request.execute()
                f.write(downloader)
            
            return str(output)
        except HttpError as e:
            raise Exception(f"Failed to download file: {e}")
    
    def create_folder(self, name: str, parent_id: Optional[str] = None) -> Dict:
        """Create a folder in Drive."""
        metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        
        if parent_id:
            metadata['parents'] = [parent_id]
        
        try:
            return self.service.files().create(body=metadata).execute()
        except HttpError as e:
            raise Exception(f"Failed to create folder: {e}")
    
    def delete_file(self, file_id: str):
        """Delete a file from Drive."""
        try:
            self.service.files().delete(fileId=file_id).execute()
        except HttpError as e:
            raise Exception(f"Failed to delete file: {e}")
    
    def share_file(
        self,
        file_id: str,
        email: Optional[str] = None,
        role: str = 'reader',
        type: str = 'user'
    ) -> Dict:
        """
        Share a file.
        
        Args:
            file_id: File to share
            email: User to share with (if None, makes link shareable)
            role: 'reader', 'commenter', or 'writer'
            type: 'user', 'group', 'domain', or 'anyone'
        """
        permission = {
            'role': role,
            'type': type if email is None else 'user'
        }
        
        if email:
            permission['emailAddress'] = email
        
        try:
            return self.service.permissions().create(
                fileId=file_id,
                body=permission
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to share file: {e}")


# ============================================================================
# SHEETS SERVICE
# ============================================================================

class SheetsService(GoogleServiceBase):
    """Google Sheets API wrapper."""
    
    SERVICE_NAME = "sheets"
    API_VERSION = "v4"
    SCOPE_SERVICE = "sheets"
    
    def get_values(self, spreadsheet_id: str, range_name: str) -> List[List]:
        """Get values from a spreadsheet range."""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()
            return result.get('values', [])
        except HttpError as e:
            raise Exception(f"Failed to get values: {e}")
    
    def update_values(
        self,
        spreadsheet_id: str,
        range_name: str,
        values: List[List],
        value_input_option: str = 'RAW'
    ) -> Dict:
        """Update values in a spreadsheet range."""
        body = {'values': values}
        
        try:
            return self.service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption=value_input_option,
                body=body
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to update values: {e}")
    
    def append_values(
        self,
        spreadsheet_id: str,
        range_name: str,
        values: List[List]
    ) -> Dict:
        """Append values to a spreadsheet."""
        body = {'values': values}
        
        try:
            return self.service.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()
        except HttpError as e:
            raise Exception(f"Failed to append values: {e}")
    
    def create_spreadsheet(self, title: str) -> Dict:
        """Create a new spreadsheet."""
        spreadsheet = {
            'properties': {'title': title}
        }
        
        try:
            return self.service.spreadsheets().create(body=spreadsheet).execute()
        except HttpError as e:
            raise Exception(f"Failed to create spreadsheet: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Google Services CLI")
    parser.add_argument("--chat-id", "-c", required=True, help="Chat ID")
    parser.add_argument("--service", "-s", required=True,
                        choices=["gmail", "calendar", "drive", "sheets"],
                        help="Google service to use")
    parser.add_argument("--action", "-a", required=True,
                        help="Action to perform (depends on service)")
    
    args = parser.parse_args()
    
    # Example usage
    print(f"Using {args.service} for chat {args.chat_id}")
    print(f"Action: {args.action}")
    print("\nUse the Python API for full functionality:")
    print(f"  from google_services import {args.service.title()}Service")
    print(f"  service = {args.service.title()}Service.for_chat('{args.chat_id}')")
