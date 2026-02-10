#!/usr/bin/env python3
"""
Google OAuth Client
Unified OAuth handling for all Google services (Gmail, Calendar, Drive, etc.)
via minion.do platform.
"""

import os
import sys
import json
import asyncio
import hashlib
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

# Configuration
MINION_BASE_URL = os.getenv("MINION_BASE_URL", "https://minion.do")
MINION_API_KEY = os.getenv("MINION_API_KEY", "")
MINION_REDIRECT_HOST = os.getenv("MINION_REDIRECT_HOST", "")
OPENCLAW_INSTANCE_ID = os.getenv("OPENCLAW_INSTANCE_ID", "openclaw-local")

# Token storage
DEFAULT_TOKEN_DIR = Path.home() / ".openclaw" / "google-tokens"
TOKEN_DIR = Path(os.getenv("GOOGLE_TOKEN_DIR", DEFAULT_TOKEN_DIR))


class GoogleService(Enum):
    """Google services supported by this client."""
    GMAIL = "gmail"
    CALENDAR = "calendar"
    DRIVE = "drive"
    SHEETS = "sheets"
    DOCS = "docs"
    PEOPLE = "people"
    ALL = "all"


class Scopes:
    """Predefined Google OAuth scope sets."""
    
    # Gmail
    GMAIL = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels"
    ]
    GMAIL_READONLY = [
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    GMAIL_SEND = [
        "https://www.googleapis.com/auth/gmail.send"
    ]
    
    # Calendar
    CALENDAR = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events"
    ]
    CALENDAR_READONLY = [
        "https://www.googleapis.com/auth/calendar.events.readonly",
        "https://www.googleapis.com/auth/calendar.readonly"
    ]
    
    # Drive
    DRIVE = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file"
    ]
    DRIVE_READONLY = [
        "https://www.googleapis.com/auth/drive.readonly"
    ]
    
    # Sheets
    SHEETS = [
        "https://www.googleapis.com/auth/spreadsheets"
    ]
    SHEETS_READONLY = [
        "https://www.googleapis.com/auth/spreadsheets.readonly"
    ]
    
    # Docs
    DOCS = [
        "https://www.googleapis.com/auth/documents"
    ]
    DOCS_READONLY = [
        "https://www.googleapis.com/auth/documents.readonly"
    ]
    
    # User info
    PEOPLE = [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid"
    ]
    
    # Combined sets
    ALL = list(set(GMAIL + CALENDAR + DRIVE + SHEETS + DOCS + PEOPLE))
    READONLY = list(set(GMAIL_READONLY + CALENDAR_READONLY + DRIVE_READONLY))


@dataclass
class AuthResult:
    """Result of OAuth authentication."""
    success: bool
    token_path: Optional[str] = None
    email: Optional[str] = None
    error: Optional[str] = None
    services: List[str] = None
    
    def __post_init__(self):
        if self.services is None:
            self.services = []


class GoogleAuthError(Exception):
    """Google OAuth authentication failed."""
    pass


class GoogleClientError(Exception):
    """Google OAuth client error."""
    pass


class GoogleAuthClient:
    """
    Client for Google OAuth via minion.do platform.
    
    Supports multiple Google services: Gmail, Calendar, Drive, Sheets, Docs.
    """
    
    def __init__(
        self,
        chat_id: str,
        chat_platform: str = "telegram",
        base_url: str = MINION_BASE_URL,
        api_key: str = MINION_API_KEY,
        instance_id: str = OPENCLAW_INSTANCE_ID,
        redirect_host: str = MINION_REDIRECT_HOST,
        token_dir: Path = TOKEN_DIR
    ):
        if not HAS_AIOHTTP:
            raise ImportError(
                "aiohttp is required. Install it: pip install aiohttp"
            )
        
        self.chat_id = chat_id
        self.chat_platform = chat_platform
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.instance_id = instance_id
        self.redirect_host = redirect_host.rstrip("/") if redirect_host else ""
        self.token_dir = token_dir
        self.token_dir.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def for_chat(
        cls,
        chat_id: str,
        chat_platform: str = "telegram",
        **kwargs
    ) -> "GoogleAuthClient":
        """Create client for a specific chat."""
        return cls(
            chat_id=chat_id,
            chat_platform=chat_platform,
            **kwargs
        )
    
    def get_scopes_for_services(self, services: List[str]) -> List[str]:
        """
        Get OAuth scopes for requested services.
        
        Args:
            services: List of service names ("gmail", "calendar", "drive", etc.)
                     or "all" for everything
        
        Returns:
            List of OAuth scope URLs
        """
        if "all" in services:
            return Scopes.ALL
        
        scopes = []
        service_map = {
            "gmail": Scopes.GMAIL,
            "calendar": Scopes.CALENDAR,
            "drive": Scopes.DRIVE,
            "sheets": Scopes.SHEETS,
            "docs": Scopes.DOCS,
            "people": Scopes.PEOPLE,
        }
        
        for service in services:
            service = service.lower()
            if service in service_map:
                scopes.extend(service_map[service])
        
        # Always include userinfo for email identification
        scopes.extend(Scopes.PEOPLE)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_scopes = []
        for scope in scopes:
            if scope not in seen:
                seen.add(scope)
                unique_scopes.append(scope)
        
        return unique_scopes
    
    async def request_auth_url(
        self,
        services: Optional[List[str]] = None,
        scopes: Optional[List[str]] = None,
        redirect_host: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Request OAuth URL from minion.do.
        
        Args:
            services: List of services to request (e.g., ["gmail", "calendar"])
            scopes: Direct list of OAuth scopes (alternative to services)
            redirect_host: Optional custom redirect host
        
        Returns:
            Dict with authUrl, state, and expiresIn
        """
        if scopes is None:
            if services is None:
                services = ["gmail", "calendar", "drive"]
            scopes = self.get_scopes_for_services(services)
        
        url = f"{self.base_url}/api/auth/init"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        payload = {
            "minionId": self.instance_id,
            "chatId": f"{self.chat_platform}:{self.chat_id}",
            "chatPlatform": self.chat_platform,
            "scopes": scopes
        }
        
        # Add custom redirect host if specified
        custom_redirect = redirect_host or self.redirect_host
        if custom_redirect:
            payload["redirectHost"] = custom_redirect
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status == 200:
                    return await resp.json()
                elif resp.status == 400:
                    try:
                        error = await resp.json()
                        raise ValueError(f"Invalid request: {error}")
                    except Exception:
                        text = await resp.text()
                        raise ValueError(f"Invalid request: {text}")
                else:
                    text = await resp.text()
                    raise GoogleClientError(f"Minion error {resp.status}: {text}")
    
    async def check_auth_status(self, state: str) -> Dict[str, Any]:
        """Check the current authentication status."""
        url = f"{self.base_url}/api/auth/callback"
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers=headers,
                params={"state": state}
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise GoogleClientError(f"Status check failed {resp.status}: {text}")
                return await resp.json()
    
    async def poll_for_tokens(
        self,
        state: str,
        max_attempts: int = 150,
        poll_interval: float = 2.0,
        on_status: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Poll minion.do for OAuth completion.
        
        Args:
            state: The state token
            max_attempts: Maximum polling attempts (default 150 = 5 min)
            poll_interval: Seconds between polls
            on_status: Callback(status, attempt) for progress
        
        Returns:
            Token data with user info
        """
        for attempt in range(max_attempts):
            data = await self.check_auth_status(state)
            status = data.get("status")
            
            if on_status:
                on_status(status, attempt + 1)
            
            if status == "completed":
                return data
            elif status == "failed":
                error = data.get("error", "unknown")
                message = data.get("message", "Authentication failed")
                raise GoogleAuthError(f"{error}: {message}")
            elif status == "pending":
                await asyncio.sleep(poll_interval)
            else:
                raise GoogleClientError(f"Unknown status: {status}")
        
        raise TimeoutError(
            f"Authentication timed out after {max_attempts * poll_interval} seconds"
        )
    
    def _get_token_path(self, service: str = "combined") -> Path:
        """Get storage path for tokens."""
        chat_hash = hashlib.sha256(self.chat_id.encode()).hexdigest()[:16]
        return self.token_dir / f"{service}-{chat_hash}.json"
    
    def _normalize_tokens(self, tokens: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize token format for google-auth library."""
        normalized = {}
        
        if "access_token" in tokens:
            normalized["token"] = tokens["access_token"]
        elif "token" in tokens:
            normalized["token"] = tokens["token"]
        
        for key in ["refresh_token", "token_uri", "client_id", "client_secret", "scopes"]:
            if key in tokens:
                normalized[key] = tokens[key]
        
        if "token_uri" not in normalized:
            normalized["token_uri"] = "https://oauth2.googleapis.com/token"
        
        return normalized
    
    def store_tokens(
        self,
        token_data: Dict[str, Any],
        service: str = "combined"
    ) -> str:
        """
        Store tokens securely.
        
        Args:
            token_data: Token response from minion.do
            service: Service identifier for token file
        
        Returns:
            Path to stored token file
        """
        token_path = self._get_token_path(service)
        
        # Extract tokens
        tokens = token_data.get("tokens", token_data)
        normalized = self._normalize_tokens(tokens)
        
        # Add metadata
        storage_data = {
            "token_data": normalized,
            "chat_id_hash": hashlib.sha256(self.chat_id.encode()).hexdigest()[:8],
            "services": service,
            "stored_at": asyncio.get_event_loop().time() if hasattr(asyncio, 'get_event_loop') else None
        }
        
        # Add user info if available
        if "userInfo" in token_data:
            storage_data["user_info"] = token_data["userInfo"]
        
        with open(token_path, "w") as f:
            json.dump(storage_data, f, indent=2)
        
        # Secure file permissions
        try:
            os.chmod(token_path, 0o600)
        except (OSError, AttributeError):
            pass
        
        return str(token_path)
    
    def load_tokens(self, service: str = "combined") -> Optional[Dict[str, Any]]:
        """Load stored tokens."""
        token_path = self._get_token_path(service)
        
        if not token_path.exists():
            # Try to find any token file for this chat
            chat_hash = hashlib.sha256(self.chat_id.encode()).hexdigest()[:16]
            for token_file in self.token_dir.glob(f"*-{chat_hash}.json"):
                with open(token_file) as f:
                    return json.load(f)
            return None
        
        with open(token_path) as f:
            return json.load(f)
    
    def get_token_for_service(self, service: str = "combined") -> Optional[Dict[str, Any]]:
        """Get token data for a specific service."""
        data = self.load_tokens(service)
        if data and "token_data" in data:
            return data["token_data"]
        return None
    
    def is_connected(self, service: str = "combined") -> bool:
        """Check if user is connected."""
        return self._get_token_path(service).exists() or self.load_tokens(service) is not None
    
    def get_user_email(self) -> Optional[str]:
        """Get the connected user's email."""
        data = self.load_tokens()
        if data and "user_info" in data:
            return data["user_info"].get("email")
        return None
    
    def get_connected_services(self) -> List[str]:
        """Get list of connected services."""
        data = self.load_tokens()
        if data and "services" in data:
            services_str = data["services"]
            if services_str == "combined":
                return ["gmail", "calendar", "drive"]
            return services_str.split(",")
        return []
    
    def disconnect(self, service: Optional[str] = None) -> bool:
        """
        Disconnect by deleting tokens.
        
        Args:
            service: Specific service to disconnect, or None for all
        
        Returns:
            True if tokens were deleted
        """
        if service:
            path = self._get_token_path(service)
            if path.exists():
                path.unlink()
                return True
            return False
        else:
            # Delete all tokens for this chat
            chat_hash = hashlib.sha256(self.chat_id.encode()).hexdigest()[:16]
            deleted = False
            for token_file in self.token_dir.glob(f"*-{chat_hash}.json"):
                token_file.unlink()
                deleted = True
            return deleted
    
    async def complete_auth(
        self,
        state: str,
        services: Optional[List[str]] = None,
        on_status: Optional[callable] = None
    ) -> AuthResult:
        """
        Complete OAuth flow: poll and store tokens.
        
        Args:
            state: State token from request_auth_url
            services: Services being connected
            on_status: Progress callback
        
        Returns:
            AuthResult with success status and details
        """
        try:
            token_data = await self.poll_for_tokens(state, on_status=on_status)
            
            service_str = ",".join(services) if services else "combined"
            token_path = self.store_tokens(token_data, service_str)
            
            email = None
            if "userInfo" in token_data:
                email = token_data["userInfo"].get("email")
            
            return AuthResult(
                success=True,
                token_path=token_path,
                email=email,
                services=services or ["all"]
            )
            
        except GoogleAuthError as e:
            return AuthResult(success=False, error=str(e))
        except TimeoutError as e:
            return AuthResult(success=False, error=f"Timeout: {e}")
        except Exception as e:
            return AuthResult(success=False, error=f"Unexpected error: {e}")


# Synchronous wrappers

def request_auth_url(
    chat_id: str,
    chat_platform: str = "telegram",
    services: Optional[List[str]] = None,
    scopes: Optional[List[str]] = None,
    redirect_host: Optional[str] = None,
    **client_kwargs
) -> Dict[str, Any]:
    """Request OAuth URL (sync wrapper)."""
    client = GoogleAuthClient.for_chat(chat_id, chat_platform, **client_kwargs)
    
    loop = _get_event_loop()
    return loop.run_until_complete(
        client.request_auth_url(services, scopes, redirect_host)
    )


def complete_auth(
    chat_id: str,
    state: str,
    chat_platform: str = "telegram",
    services: Optional[List[str]] = None,
    on_status: Optional[callable] = None,
    **client_kwargs
) -> AuthResult:
    """Complete OAuth flow (sync wrapper)."""
    client = GoogleAuthClient.for_chat(chat_id, chat_platform, **client_kwargs)
    
    loop = _get_event_loop()
    return loop.run_until_complete(
        client.complete_auth(state, services, on_status)
    )


def is_connected(chat_id: str, chat_platform: str = "telegram", **client_kwargs) -> bool:
    """Check if Google is connected (sync wrapper)."""
    client = GoogleAuthClient.for_chat(chat_id, chat_platform, **client_kwargs)
    return client.is_connected()


def get_user_email(chat_id: str, chat_platform: str = "telegram", **client_kwargs) -> Optional[str]:
    """Get connected user's email (sync wrapper)."""
    client = GoogleAuthClient.for_chat(chat_id, chat_platform, **client_kwargs)
    return client.get_user_email()


def disconnect(chat_id: str, chat_platform: str = "telegram", service: Optional[str] = None, **client_kwargs) -> bool:
    """Disconnect Google (sync wrapper)."""
    client = GoogleAuthClient.for_chat(chat_id, chat_platform, **client_kwargs)
    return client.disconnect(service)


def _get_event_loop():
    """Get or create event loop."""
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


if __name__ == "__main__":
    # CLI for testing
    import argparse
    
    parser = argparse.ArgumentParser(description="Google OAuth Client")
    parser.add_argument("--chat-id", "-c", required=True, help="Chat/user ID")
    parser.add_argument("--platform", "-p", default="telegram", help="Platform")
    parser.add_argument("--services", "-s", default="gmail,calendar,drive",
                        help="Comma-separated services (gmail,calendar,drive,sheets,docs,all)")
    parser.add_argument("--status", action="store_true", help="Check connection status")
    parser.add_argument("--disconnect", action="store_true", help="Disconnect")
    parser.add_argument("--redirect-host", help="Custom redirect host URL")
    
    args = parser.parse_args()
    
    client = GoogleAuthClient.for_chat(args.chat_id, args.platform)
    
    if args.status:
        if client.is_connected():
            email = client.get_user_email()
            services = client.get_connected_services()
            print(f"✓ Connected")
            print(f"  Email: {email or 'Unknown'}")
            print(f"  Services: {', '.join(services)}")
        else:
            print("✗ Not connected")
    elif args.disconnect:
        if client.disconnect():
            print("✓ Disconnected (tokens deleted)")
        else:
            print("✗ Was not connected")
    else:
        # Start OAuth flow
        services = args.services.split(",")
        print(f"Starting OAuth for services: {services}")
        
        try:
            result = request_auth_url(
                args.chat_id,
                args.platform,
                services=services,
                redirect_host=args.redirect_host
            )
            print(f"\nAuth URL: {result['authUrl']}")
            print(f"State: {result['state'][:20]}...")
            print(f"\nSend URL to user and wait...")
        except Exception as e:
            print(f"Error: {e}")
