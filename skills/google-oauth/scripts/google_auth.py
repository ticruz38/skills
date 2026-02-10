#!/usr/bin/env python3
"""
Google OAuth CLI
Main entry point for Google OAuth authentication via minion.do
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Optional, List

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from google_auth_client import (
    GoogleAuthClient,
    GoogleService,
    Scopes,
    request_auth_url,
    complete_auth,
    is_connected,
    get_user_email,
    disconnect as disconnect_google
)


# ANSI colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_success(msg: str):
    print(f"{Colors.GREEN}✓{Colors.RESET} {msg}")


def print_error(msg: str):
    print(f"{Colors.RED}✗{Colors.RESET} {msg}", file=sys.stderr)


def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {msg}")


def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {msg}")


def parse_services(services_str: str) -> List[str]:
    """Parse comma-separated service list."""
    if not services_str or services_str.lower() == "all":
        return ["all"]
    
    valid_services = ["gmail", "calendar", "drive", "sheets", "docs", "people", "all"]
    services = [s.strip().lower() for s in services_str.split(",")]
    
    # Validate
    for service in services:
        if service not in valid_services:
            raise ValueError(f"Invalid service: {service}. Valid: {', '.join(valid_services)}")
    
    return services


def format_services_badge(services: List[str]) -> str:
    """Format service list for display."""
    if "all" in services:
        return "Gmail, Calendar, Drive, Sheets, Docs"
    return ", ".join(s.title() for s in services)


def cmd_status(
    chat_id: str,
    platform: str,
    client_kwargs: dict
) -> int:
    """Show connection status."""
    print(f"{Colors.BOLD}Google OAuth Status{Colors.RESET}")
    print("=" * 50)
    
    client = GoogleAuthClient.for_chat(chat_id, platform, **client_kwargs)
    
    if client.is_connected():
        email = client.get_user_email()
        services = client.get_connected_services()
        token_data = client.load_tokens()
        
        print_success("Connected to Google")
        print(f"\n  Account: {Colors.BOLD}{email or 'Unknown'}{Colors.RESET}")
        print(f"  Platform: {platform}")
        print(f"  Chat ID: {chat_id}")
        
        if services:
            print(f"\n  Authorized Services:")
            for service in services:
                print(f"    ✓ {service.title()}")
        
        if token_data and 'stored_at' in token_data:
            print(f"\n  Token stored at: {client._get_token_path()}")
    else:
        print_error("Not connected to Google")
        print("\n  Run: google_auth.py --chat-id <id> --services <services>")
    
    return 0 if client.is_connected() else 1


def cmd_connect(
    chat_id: str,
    platform: str,
    services: List[str],
    redirect_host: Optional[str],
    client_kwargs: dict
) -> int:
    """Initiate OAuth connection."""
    print(f"{Colors.BOLD}Google OAuth Connection{Colors.RESET}")
    print("=" * 50)
    
    # Check if already connected
    if is_connected(chat_id, platform, **client_kwargs):
        email = get_user_email(chat_id, platform, **client_kwargs)
        print_warning(f"Already connected as {email}")
        print("\n  Use --disconnect first to reconnect with different services.")
        return 0
    
    try:
        # Request auth URL
        print_info(f"Requesting OAuth URL for: {format_services_badge(services)}")
        
        result = request_auth_url(
            chat_id=chat_id,
            chat_platform=platform,
            services=services,
            redirect_host=redirect_host,
            **client_kwargs
        )
        
        print_success("Auth URL generated")
        print(f"\n  URL: {Colors.BLUE}{result['authUrl']}{Colors.RESET}")
        print(f"  State: {result['state'][:30]}...")
        print(f"  Expires in: {result['expiresIn']} seconds ({result['expiresIn'] // 60} minutes)")
        
        print(f"\n{Colors.BOLD}Next Steps:{Colors.RESET}")
        print("  1. Send the auth URL to the user")
        print("  2. User clicks and authorizes with Google")
        print("  3. Poll for completion or wait for webhook")
        
        # Auto-poll if requested
        print(f"\n{Colors.YELLOW}Polling for authorization...{Colors.RESET}")
        print("  (Press Ctrl+C to cancel)\n")
        
        def on_status(status: str, attempt: int):
            if attempt % 15 == 0:  # Every ~30 seconds
                print(f"  ... still waiting (attempt {attempt}, status: {status})")
        
        try:
            auth_result = complete_auth(
                chat_id=chat_id,
                state=result['state'],
                chat_platform=platform,
                services=services,
                on_status=on_status,
                **client_kwargs
            )
            
            if auth_result.success:
                print_success("Authentication successful!")
                print(f"\n  Account: {Colors.BOLD}{auth_result.email}{Colors.RESET}")
                print(f"  Token stored: {auth_result.token_path}")
                print(f"  Services: {format_services_badge(services)}")
                return 0
            else:
                print_error(f"Authentication failed: {auth_result.error}")
                return 1
                
        except KeyboardInterrupt:
            print_warning("\n  Polling cancelled by user")
            print(f"\n  To complete manually, run:")
            print(f"    google_auth.py --chat-id {chat_id} --complete {result['state']}")
            return 130
            
    except Exception as e:
        print_error(f"Failed to initiate OAuth: {e}")
        return 1


def cmd_disconnect(
    chat_id: str,
    platform: str,
    service: Optional[str],
    client_kwargs: dict
) -> int:
    """Disconnect Google account."""
    print(f"{Colors.BOLD}Google OAuth Disconnect{Colors.RESET}")
    print("=" * 50)
    
    if disconnect_google(chat_id, platform, service, **client_kwargs):
        if service:
            print_success(f"Disconnected {service} service")
        else:
            print_success("Disconnected all Google services")
        print("\n  Tokens have been deleted.")
        return 0
    else:
        print_error("Not connected")
        return 1


def cmd_test(
    chat_id: str,
    platform: str,
    service: str,
    client_kwargs: dict
) -> int:
    """Test a Google service connection."""
    print(f"{Colors.BOLD}Google Service Test: {service.title()}{Colors.RESET}")
    print("=" * 50)
    
    sys.path.insert(0, str(Path(__file__).parent))
    
    try:
        if service == "gmail":
            from google_services import GmailService
            svc = GmailService.for_chat(chat_id, platform)
            labels = svc.list_labels()
            print_success(f"Connected! Found {len(labels)} labels")
            print(f"\n  Sample labels:")
            for label in labels[:5]:
                print(f"    - {label['name']}")
                
        elif service == "calendar":
            from google_services import CalendarService
            svc = CalendarService.for_chat(chat_id, platform)
            calendars = svc.list_calendars()
            print_success(f"Connected! Found {len(calendars)} calendars")
            print(f"\n  Calendars:")
            for cal in calendars[:5]:
                print(f"    - {cal['summary']}")
                
        elif service == "drive":
            from google_services import DriveService
            svc = DriveService.for_chat(chat_id, platform)
            files = svc.list_files(page_size=5)
            print_success(f"Connected! Found files in Drive")
            print(f"\n  Recent files:")
            for f in files:
                print(f"    - {f['name']} ({f.get('mimeType', 'unknown').split('/')[-1]})")
                
        elif service == "sheets":
            from google_services import SheetsService
            print_info("Sheets service initialized")
            print("  Use Python API to access spreadsheets")
            
        else:
            print_error(f"Unknown service: {service}")
            return 1
            
    except Exception as e:
        print_error(f"Test failed: {e}")
        return 1
    
    return 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Google OAuth CLI - Authenticate with Google services",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check status
  %(prog)s --chat-id 123456789 --status
  
  # Connect Gmail only
  %(prog)s --chat-id 123456789 --services gmail
  
  # Connect all services
  %(prog)s --chat-id 123456789 --services all
  
  # Connect with custom redirect
  %(prog)s --chat-id 123456789 --services calendar,drive \\
           --redirect-host https://your-domain.com/auth/callback
  
  # Test connection
  %(prog)s --chat-id 123456789 --test gmail
  
  # Disconnect
  %(prog)s --chat-id 123456789 --disconnect
        """
    )
    
    # Required
    parser.add_argument("--chat-id", "-c", help="Chat/user ID")
    parser.add_argument("--platform", "-p", default="telegram",
                        choices=["telegram", "whatsapp"],
                        help="Chat platform (default: telegram)")
    
    # Actions
    parser.add_argument("--status", action="store_true",
                        help="Check connection status")
    parser.add_argument("--services", "-s",
                        help="Services to connect: gmail,calendar,drive,sheets,docs,all")
    parser.add_argument("--disconnect", action="store_true",
                        help="Disconnect Google account")
    parser.add_argument("--test", metavar="SERVICE",
                        help="Test a service connection (gmail,calendar,drive,sheets)")
    
    # Options
    parser.add_argument("--redirect-host",
                        help="Custom OAuth redirect host URL")
    parser.add_argument("--base-url", default=os.getenv("MINION_BASE_URL", "https://minion.do"),
                        help="Minion.do base URL")
    parser.add_argument("--api-key", default=os.getenv("MINION_API_KEY", ""),
                        help="Minion.do API key")
    parser.add_argument("--instance-id", default=os.getenv("OPENCLAW_INSTANCE_ID", "openclaw-local"),
                        help="OpenClaw instance ID")
    
    args = parser.parse_args()
    
    # Validate chat_id
    if not args.chat_id:
        parser.error("--chat-id is required")
    
    # Build client kwargs
    client_kwargs = {
        "base_url": args.base_url,
        "api_key": args.api_key,
        "instance_id": args.instance_id
    }
    
    # Route to command
    if args.status:
        return cmd_status(args.chat_id, args.platform, client_kwargs)
    
    elif args.disconnect:
        return cmd_disconnect(args.chat_id, args.platform, None, client_kwargs)
    
    elif args.test:
        return cmd_test(args.chat_id, args.platform, args.test.lower(), client_kwargs)
    
    elif args.services:
        try:
            services = parse_services(args.services)
        except ValueError as e:
            print_error(str(e))
            return 1
        
        return cmd_connect(
            args.chat_id,
            args.platform,
            services,
            args.redirect_host,
            client_kwargs
        )
    
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
