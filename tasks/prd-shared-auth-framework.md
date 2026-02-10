# PRD: Shared Authentication Framework

## Introduction

A centralized authentication management system for OpenClaw skills. Instead of each skill implementing its own OAuth flows, API key handling, and token storage, this framework provides a unified interface for all authentication needs. Skills declare their auth requirements, and the framework handles the complexity.

## Goals

- Provide single sign-on experience across all skills
- Eliminate duplicate OAuth implementations
- Secure credential storage with automatic rotation
- Support multiple auth types: OAuth 2.0, API keys, JWT, Basic Auth
- Allow skills to depend on auth providers without implementing auth logic
- Enable credential sharing between related skills (e.g., all Google services)

## User Stories

### US-001: Centralized OAuth Management
**Description:** As a user, I want to authenticate once with Google and have all Google-dependent skills work without re-authenticating.

**Acceptance Criteria:**
- [ ] User connects Google account via `auth-provider` skill
- [ ] Token is stored securely with 0600 permissions
- [ ] `calendar`, `email`, `drive` skills can request tokens from `auth-provider`
- [ ] Token auto-refreshes when expired
- [ ] User can revoke access from single location
- [ ] Typecheck passes

### US-002: API Key Management
**Description:** As a user, I want to store API keys securely and have skills request them by name without hardcoding.

**Acceptance Criteria:**
- [ ] User can add API key: `auth-provider add-key openai sk-xxx`
- [ ] Keys are encrypted at rest (AES-256-GCM)
- [ ] Skills request keys by name: `auth-provider get-key openai`
- [ ] Keys can be updated without reconfiguring skills
- [ ] Keys are never logged or displayed in plain text
- [ ] Typecheck passes

### US-003: Auth Dependency Declaration
**Description:** As a skill developer, I want to declare auth dependencies in my skill.yaml without implementing auth logic.

**Acceptance Criteria:**
- [ ] Skill can declare: `depends_on: [google-oauth, openai-key]`
- [ ] Framework validates dependencies before skill execution
- [ ] Missing auth triggers automatic onboarding flow
- [ ] Skill receives auth config via environment variables
- [ ] Auth scopes are validated against declared requirements
- [ ] Typecheck passes

### US-004: Multi-Provider Support
**Description:** As a user, I want to connect multiple accounts from the same provider (e.g., two Google accounts).

**Acceptance Criteria:**
- [ ] Support named profiles: `google-work`, `google-personal`
- [ ] Skills can specify which profile to use
- [ ] Default profile used when none specified
- [ ] Profile switching doesn't break existing skills
- [ ] UI shows all connected accounts per provider
- [ ] Typecheck passes

### US-005: Auth Health Monitoring
**Description:** As a user, I want to know when my authentication is broken or expiring soon.

**Acceptance Criteria:**
- [ ] Health check command: `auth-provider health`
- [ ] Shows all providers and their status
- [ ] Warns about tokens expiring within 7 days
- [ ] Detects invalid/revoked credentials
- [ ] Provides re-auth command for broken connections
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Support OAuth 2.0 flows (authorization code, PKCE, device code)
- FR-2: Support API key storage and retrieval
- FR-3: Support JWT token handling (validation, refresh)
- FR-4: Encrypt all credentials at rest with user-specific key
- FR-5: Auto-refresh OAuth tokens before expiration
- FR-6: Provide CLI for credential management
- FR-7: Provide library interface for skill integration
- FR-8: Support credential migration between versions
- FR-9: Audit log for all credential access
- FR-10: Support scoped credentials (read-only vs read-write)

## Non-Goals

- No GUI/web interface (CLI only)
- No credential sharing between users
- No cloud sync (local storage only)
- No SSO/SAML enterprise auth (OAuth/API keys only)
- No biometric authentication

## Technical Considerations

### Storage Structure
```
~/.openclaw/auth/
├── providers/
│   ├── google/
│   │   ├── default.json          # Encrypted tokens
│   │   └── work.json             # Named profile
│   ├── binance/
│   │   └── default.json
│   └── openai/
│       └── default.json
├── keys/                          # API keys
│   ├── openai.enc
│   └── serper.enc
├── master.key                     # Encryption key (0600)
└── audit.log                      # Access logs
```

### Encryption
- Master key: Random 256-bit key stored in `~/.openclaw/auth/master.key`
- Credentials encrypted with AES-256-GCM using master key
- Master key can be protected by password (optional)

### Provider Interface
```javascript
class AuthProvider {
  async authenticate(provider, profile = 'default', scopes = []);
  async getToken(provider, profile = 'default');
  async refreshToken(provider, profile = 'default');
  async revoke(provider, profile = 'default');
  async listProfiles(provider);
  async health(provider);
}
```

### Skill Integration
```yaml
# In skill.yaml
dependencies:
  auth:
    - provider: google
      profile: default
      scopes: [calendar, email]
    - provider: openai
      type: api_key
```

## Success Metrics

- 100% of OAuth skills use framework (no custom OAuth impl)
- < 100ms token retrieval time
- Zero credential leaks in logs
- User connects Google once, 5+ skills work immediately

## Open Questions

- Should we support 1Password/Bitwarden integration?
- How to handle auth in CI/CD environments?
- Should we support SSH key management too?

## Implementation Plan

### Phase 1: Core Framework
- US-001: OAuth management
- US-002: API key storage
- FR-1, FR-2, FR-4, FR-5

### Phase 2: Skill Integration
- US-003: Dependency system
- US-004: Multi-profile support
- FR-3, FR-6, FR-7

### Phase 3: Polish
- US-005: Health monitoring
- FR-8, FR-9, FR-10
