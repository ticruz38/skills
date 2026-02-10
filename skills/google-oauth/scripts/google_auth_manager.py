#!/usr/bin/env python3
"""
Google Auth Manager for OpenClaw
High-level manager for handling Google OAuth requests in chat.
"""

import re
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from google_auth_client import (
    GoogleAuthClient,
    GoogleService,
    Scopes,
    AuthResult
)


@dataclass
class ParsedRequest:
    """Parsed user request."""
    is_auth_request: bool
    action: str  # 'connect', 'disconnect', 'status', 'none'
    services: List[str]
    platform: str


class GoogleAuthManager:
    """
    Manager for handling Google OAuth requests in OpenClaw chat.
    
    Usage:
        auth = GoogleAuthManager(platform="telegram")
        response = auth.handle_request(chat_id, message_text)
        if response:
            send_message(chat_id, response["text"])
            for action in response.get("actions", []):
                handle_action(action)
    """
    
    # Natural language patterns
    CONNECT_PATTERNS = [
        r'connect\s+(?:my\s+)?google(?:\s+account)?',
        r'link\s+(?:my\s+)?google',
        r'authorize\s+google',
        r'setup\s+google',
        r'google\s+(?:auth|oauth|login)',
        r'sign\s+(?:in|into)\s+google',
    ]
    
    DISCONNECT_PATTERNS = [
        r'disconnect\s+(?:my\s+)?google',
        r'logout\s+(?:of\s+)?google',
        r'remove\s+google',
        r'unlink\s+google',
        r'sign\s+out\s+(?:of\s+)?google',
    ]
    
    STATUS_PATTERNS = [
        r'google\s+status',
        r'is\s+google\s+connected',
        r'check\s+google',
        r'google\s+connection\s+status',
    ]
    
    # Service-specific patterns
    SERVICE_PATTERNS = {
        'gmail': [
            r'connect\s+(?:my\s+)?gmail',
            r'link\s+(?:my\s+)?gmail',
            r'gmail\s+(?:auth|oauth|login)',
            r'authorize\s+gmail',
        ],
        'calendar': [
            r'connect\s+(?:my\s+)?(?:google\s+)?calendar',
            r'link\s+(?:my\s+)?calendar',
            r'calendar\s+(?:auth|oauth|login)',
        ],
        'drive': [
            r'connect\s+(?:my\s+)?(?:google\s+)?drive',
            r'link\s+(?:my\s+)?drive',
            r'drive\s+(?:auth|oauth|login)',
        ],
    }
    
    def __init__(
        self,
        platform: str = "telegram",
        default_services: Optional[List[str]] = None,
        **client_kwargs
    ):
        self.platform = platform
        self.default_services = default_services or ["gmail", "calendar", "drive"]
        self.client_kwargs = client_kwargs
        self._pending_auths: Dict[str, dict] = {}  # state -> auth_info
    
    def parse_request(self, message_text: str) -> ParsedRequest:
        """
        Parse a user message for Google auth intent.
        
        Returns:
            ParsedRequest with detected action and services
        """
        text_lower = message_text.lower().strip()
        
        # Check for disconnection
        for pattern in self.DISCONNECT_PATTERNS:
            if re.search(pattern, text_lower):
                return ParsedRequest(
                    is_auth_request=True,
                    action='disconnect',
                    services=[],
                    platform=self.platform
                )
        
        # Check for status
        for pattern in self.STATUS_PATTERNS:
            if re.search(pattern, text_lower):
                return ParsedRequest(
                    is_auth_request=True,
                    action='status',
                    services=[],
                    platform=self.platform
                )
        
        # Check for service-specific connection
        services = []
        for service, patterns in self.SERVICE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    services.append(service)
                    break
        
        if services:
            return ParsedRequest(
                is_auth_request=True,
                action='connect',
                services=services,
                platform=self.platform
            )
        
        # Check for general connection
        for pattern in self.CONNECT_PATTERNS:
            if re.search(pattern, text_lower):
                # Check if "all" services mentioned
                if 'all' in text_lower or 'everything' in text_lower:
                    services = ['all']
                else:
                    services = self.default_services
                
                return ParsedRequest(
                    is_auth_request=True,
                    action='connect',
                    services=services,
                    platform=self.platform
                )
        
        return ParsedRequest(
            is_auth_request=False,
            action='none',
            services=[],
            platform=self.platform
        )
    
    def handle_request(
        self,
        chat_id: str,
        message_text: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle a potential Google auth request.
        
        Returns:
            Response dict with 'text' and optional 'actions',
            or None if not an auth request
        """
        parsed = self.parse_request(message_text)
        
        if not parsed.is_auth_request:
            return None
        
        # Route to handler
        if parsed.action == 'connect':
            return self._handle_connect(chat_id, parsed.services)
        elif parsed.action == 'disconnect':
            return self._handle_disconnect(chat_id)
        elif parsed.action == 'status':
            return self._handle_status(chat_id)
        
        return None
    
    def _handle_connect(
        self,
        chat_id: str,
        services: List[str]
    ) -> Dict[str, Any]:
        """Handle connection request."""
        client = GoogleAuthClient.for_chat(
            chat_id,
            self.platform,
            **self.client_kwargs
        )
        
        # Check if already connected
        if client.is_connected():
            email = client.get_user_email()
            existing_services = client.get_connected_services()
            
            service_list = self._format_services(existing_services)
            
            return {
                "text": (
                    f"✅ **Google Account Already Connected**\n\n"
                    f"📧 **{email or 'Unknown'}**\n\n"
                    f"Currently authorized:\n{service_list}\n\n"
                    f"You can use Google commands like:\n"
                    f"• 'Show my unread emails'\n"
                    f"• 'What's on my calendar today?'\n"
                    f"• 'List my Drive files'\n\n"
                    f"To reconnect with different services, say **'disconnect Google'** first."
                ),
                "actions": []
            }
        
        try:
            # Request auth URL
            import asyncio
            
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(
                client.request_auth_url(services=services)
            )
            
            auth_url = result["authUrl"]
            state = result["state"]
            expires_in = result["expiresIn"]
            
            # Store pending auth
            self._pending_auths[state] = {
                "chat_id": chat_id,
                "services": services,
                "requested_at": loop.time()
            }
            
            service_names = self._format_services(services)
            
            return {
                "text": (
                    f"🔗 **Connect Your Google Account**\n\n"
                    f"I'll need access to:\n{service_names}\n\n"
                    f"Click this secure link to authorize:\n"
                    f"{auth_url}\n\n"
                    f"⏳ Link expires in {expires_in // 60} minutes.\n"
                    f"I'll let you know once you're connected!"
                ),
                "actions": [{
                    "type": "poll_oauth",
                    "state": state,
                    "chat_id": chat_id,
                    "platform": self.platform,
                    "services": services
                }]
            }
            
        except Exception as e:
            return {
                "text": (
                    f"❌ **Failed to Start Google Connection**\n\n"
                    f"Error: {str(e)}\n\n"
                    f"Please try again later or contact support."
                ),
                "actions": []
            }
    
    def _handle_disconnect(self, chat_id: str) -> Dict[str, Any]:
        """Handle disconnection request."""
        client = GoogleAuthClient.for_chat(
            chat_id,
            self.platform,
            **self.client_kwargs
        )
        
        if client.disconnect():
            return {
                "text": (
                    f"✅ **Google Account Disconnected**\n\n"
                    f"Your Google tokens have been securely deleted.\n\n"
                    f"To reconnect, just say **'connect my Google account'**."
                ),
                "actions": []
            }
        else:
            return {
                "text": (
                    f"ℹ️ **Not Connected**\n\n"
                    f"Your Google account isn't connected.\n\n"
                    f"Say **'connect my Google account'** to get started."
                ),
                "actions": []
            }
    
    def _handle_status(self, chat_id: str) -> Dict[str, Any]:
        """Handle status check request."""
        client = GoogleAuthClient.for_chat(
            chat_id,
            self.platform,
            **self.client_kwargs
        )
        
        if client.is_connected():
            email = client.get_user_email()
            services = client.get_connected_services()
            
            service_list = self._format_services(services)
            
            # Build available commands based on services
            commands = []
            if 'gmail' in services or 'all' in services:
                commands.extend([
                    "• **Gmail**: 'Show unread emails', 'Send email to...'",
                    "• **Gmail**: 'Find emails from...', 'Archive emails...'"
                ])
            if 'calendar' in services or 'all' in services:
                commands.extend([
                    "• **Calendar**: 'What's on my calendar?'",
                    "• **Calendar**: 'Create event tomorrow at 3pm...'"
                ])
            if 'drive' in services or 'all' in services:
                commands.extend([
                    "• **Drive**: 'List my Drive files'",
                    "• **Drive**: 'Upload to Drive...'"
                ])
            
            commands_text = '\n'.join(commands) if commands else "No specific commands available."
            
            return {
                "text": (
                    f"✅ **Google Account Connected**\n\n"
                    f"📧 **{email or 'Unknown'}**\n\n"
                    f"**Authorized Services:**\n{service_list}\n\n"
                    f"**Available Commands:**\n{commands_text}\n\n"
                    f"To disconnect, say **'disconnect Google'**."
                ),
                "actions": []
            }
        else:
            return {
                "text": (
                    f"ℹ️ **Google Account Not Connected**\n\n"
                    f"Say **'connect my Google account'** to authorize access to:\n"
                    f"• Gmail (read/send emails)\n"
                    f"• Calendar (view/create events)\n"
                    f"• Drive (access files)\n\n"
                    f"Or specify services: **'connect Gmail only'** or **'connect Calendar and Drive'**"
                ),
                "actions": []
            }
    
    def _format_services(self, services: List[str]) -> str:
        """Format service list for display."""
        if 'all' in services:
            return (
                "  • 📧 Gmail (read/send/manage emails)\n"
                "  • 📅 Calendar (view/create events)\n"
                "  • 📁 Drive (access/manage files)\n"
                "  • 📊 Sheets (read/write spreadsheets)\n"
                "  • 📝 Docs (create/edit documents)"
            )
        
        service_emojis = {
            'gmail': '📧',
            'calendar': '📅',
            'drive': '📁',
            'sheets': '📊',
            'docs': '📝',
            'people': '👤'
        }
        
        lines = []
        for s in services:
            emoji = service_emojis.get(s, '🔹')
            desc = {
                'gmail': 'read/send/manage emails',
                'calendar': 'view/create events',
                'drive': 'access/manage files',
                'sheets': 'read/write spreadsheets',
                'docs': 'create/edit documents',
                'people': 'access profile info'
            }.get(s, s.title())
            lines.append(f"  • {emoji} {s.title()} ({desc})")
        
        return '\n'.join(lines) if lines else "  • (no services specified)"
    
    async def poll_and_complete(
        self,
        state: str,
        chat_id: str,
        services: List[str],
        send_message_callback: callable
    ):
        """
        Poll for OAuth completion and notify user.
        
        This should run in a background task.
        """
        client = GoogleAuthClient.for_chat(
            chat_id,
            self.platform,
            **self.client_kwargs
        )
        
        def on_status(status: str, attempt: int):
            # Could log progress here
            pass
        
        try:
            result = await client.complete_auth(
                state=state,
                services=services,
                on_status=on_status
            )
            
            if result.success:
                service_list = self._format_services(services)
                
                send_message_callback(
                    chat_id,
                    (
                        f"✅ **Google Account Connected!**\n\n"
                        f"📧 **{result.email}**\n\n"
                        f"**Authorized Services:**\n{service_list}\n\n"
                        f"You can now use commands like:\n"
                        f"• 'Show my unread emails'\n"
                        f"• 'What's on my calendar today?'\n"
                        f"• 'List files in my Drive'\n\n"
                        f"Your credentials are stored securely."
                    )
                )
            else:
                send_message_callback(
                    chat_id,
                    (
                        f"❌ **Google Connection Failed**\n\n"
                        f"{result.error}\n\n"
                        f"You can try again by saying 'connect my Google account'."
                    )
                )
                
        except Exception as e:
            send_message_callback(
                chat_id,
                (
                    f"❌ **Connection Error**\n\n"
                    f"An unexpected error occurred: {str(e)}\n\n"
                    f"Please try again later."
                )
            )
        finally:
            # Clean up pending auth
            self._pending_auths.pop(state, None)


# Example usage for OpenClaw integration

def example_integration():
    """Example of how OpenClaw would use this manager."""
    
    # Initialize manager
    auth_manager = GoogleAuthManager(
        platform="telegram",
        default_services=["gmail", "calendar", "drive"]
    )
    
    # Example messages
    test_messages = [
        "Hello!",
        "Connect my Google account",
        "What's my Google status?",
        "Connect Gmail only",
        "Connect Calendar and Drive",
        "Disconnect Google",
        "Connect all Google services",
    ]
    
    chat_id = "123456789"
    
    for msg in test_messages:
        print(f"\n{'='*60}")
        print(f"User: {msg}")
        print('-'*60)
        
        response = auth_manager.handle_request(chat_id, msg)
        
        if response:
            print(f"Bot:\n{response['text']}")
            if response['actions']:
                print(f"\n[Background action: {response['actions'][0]['type']}]")
        else:
            print("(Not a Google auth request - handle with other handlers)")


if __name__ == "__main__":
    example_integration()
