# PRD: OpenClaw Skills Platform

## Introduction

A unified platform for deploying 60+ AI-powered skills across 17 professional profiles. Instead of building isolated skills, we create a cohesive ecosystem with shared infrastructure, common patterns, and reusable components. This platform enables rapid skill development while ensuring consistency, security, and scalability.

**The 17 Profiles:** Accountant, Secretary, Trader, Content Creator, Invoice Chaser, Receipt Tracker, Researcher, Email Handler, Gift Guru, Meal Planner, Home Handyman, Trip Planner, Realtor, Analyst, Restaurant, Support, Scheduler.

## Goals

- Deploy 60+ production-ready skills across 17 profiles within 3 months
- Reduce skill development time by 70% through shared infrastructure
- Achieve 95%+ test coverage across all skills
- Support 10,000+ concurrent users with <100ms response time
- Maintain zero credential leaks through centralized auth framework

## User Stories

### US-001: Shared Authentication Framework
**Description:** As a skill developer, I want a centralized auth system so I don't implement OAuth separately for each skill.

**Acceptance Criteria:**
- [ ] Auth provider supports OAuth 2.0, API keys, JWT
- [ ] Credentials encrypted at rest (AES-256-GCM)
- [ ] Token auto-refresh for OAuth providers
- [ ] Multi-profile support (e.g., 2 Google accounts)
- [ ] Health monitoring with expiration warnings
- [ ] Skills declare auth dependencies in skill.yaml
- [ ] Typecheck passes

### US-002: Unified Skill Runtime
**Description:** As an agent user, I want skills to work consistently regardless of which profile I activate.

**Acceptance Criteria:**
- [ ] Common CLI interface for all skills (SKILL.md format)
- [ ] Standardized entry points (./entry.sh, ./index.js)
- [ ] Consistent JSON output format across skills
- [ ] Unified error handling and logging
- [ ] Health check endpoint for all skills
- [ ] Typecheck passes

### US-003: Skill Registry & Discovery
**Description:** As a user, I want to browse and install skills easily from a central registry.

**Acceptance Criteria:**
- [ ] Skills indexed with metadata (name, description, category, auth requirements)
- [ ] Search by profile, capability, or keyword
- [ ] One-command installation: `npx skills add [repo] --skill [name]`
- [ ] Dependency resolution (auto-install auth-provider if needed)
- [ ] Version management and updates
- [ ] Typecheck passes

### US-004: Cross-Skill Data Sharing
**Description:** As a user, I want my skills to share relevant data (e.g., receipts → expenses → reports).

**Acceptance Criteria:**
- [ ] Shared data models for common entities (contacts, transactions, events)
- [ ] Event bus for cross-skill notifications
- [ ] Data lineage tracking
- [ ] User controls data sharing permissions
- [ ] GDPR-compliant data export/deletion
- [ ] Typecheck passes

### US-005: Profile-Based Skill Bundles
**Description:** As a user, I want to activate a complete profile (e.g., "Accountant") with one command.

**Acceptance Criteria:**
- [ ] Profile manifests define skill sets
- [ ] Bulk installation: `npx skills add-profile accountant`
- [ ] Profile-specific onboarding (collect all auth at once)
- [ ] Profile switching without data loss
- [ ] Shared config across profile skills
- [ ] Typecheck passes

### US-006: Skill Development SDK
**Description:** As a developer, I want templates and tools to create new skills quickly.

**Acceptance Criteria:**
- [ ] CLI tool: `skills init [skill-name]` generates boilerplate
- [ ] Templates for common patterns (API integration, OAuth, local-only)
- [ ] Local testing framework
- [ ] Validation tool for skill.yaml
- [ ] Documentation generator from skill.yaml
- [ ] Typecheck passes

### US-007: Monitoring & Observability
**Description:** As an operator, I want visibility into skill health and usage.

**Acceptance Criteria:**
- [ ] Centralized logging with structured format
- [ ] Metrics collection (latency, errors, usage)
- [ ] Health dashboard for all installed skills
- [ ] Alerting for failing skills
- [ ] Usage analytics per skill/profile
- [ ] Typecheck passes

## Functional Requirements

### Infrastructure Layer

- **FR-1:** Auth provider service with pluggable providers (Google, Microsoft, Binance, QuickBooks, etc.)
- **FR-2:** Encrypted credential storage with master key derivation
- **FR-3:** Skill runtime with standardized execution environment
- **FR-4:** Event bus for inter-skill communication (Redis or NATS)
- **FR-5:** Shared database for cross-skill entities (SQLite or PostgreSQL)
- **FR-6:** Configuration management with environment-specific overrides
- **FR-7:** Logging aggregation with structured JSON output
- **FR-8:** Health check aggregation from all skills

### Skill Layer

- **FR-9:** SKILL.md parser with frontmatter extraction
- **FR-10:** Capability discovery from markdown documentation
- **FR-11:** Onboarding flow orchestrator for multi-step setup
- **FR-12:** Skill dependency resolver and installer
- **FR-13:** Version compatibility checking between skills
- **FR-14:** Sandboxed skill execution with resource limits
- **FR-15:** Auto-generated CLI from skill.yaml capabilities

### Profile Layer

- **FR-16:** Profile manifest format (YAML) listing skills and configs
- **FR-17:** Profile installer that resolves all skill dependencies
- **FR-18:** Profile-specific onboarding wizard
- **FR-19:** Data migration between profile versions
- **FR-20:** Profile marketplace for sharing configurations

### Developer Experience

- **FR-21:** `skills-cli` with init, test, validate, publish commands
- **FR-22:** Local skill testing with mock auth/data
- **FR-23:** Hot reload for skill development
- **FR-24:** Automated testing framework for skills
- **FR-25:** Documentation site generation from skill registry

## Non-Goals

- No web UI for skill management (CLI-only for v1)
- No multi-user/team features (personal use only)
- No cloud hosting of skills (local execution only)
- No custom skill marketplace (GitHub-based distribution)
- No real-time collaboration features
- No mobile apps (desktop/CLI only)

## Technical Considerations

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    User (CLI / Agent)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 Skills Orchestrator                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Parser    │  │  Dependency  │  │    Execution       │  │
│  │ (SKILL.md)  │  │   Resolver   │  │     Engine         │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Shared Infrastructure                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Auth      │  │    Event     │  │      Shared        │  │
│  │  Provider   │  │     Bus      │  │     Database       │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Individual Skills                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ calendar│ │  email  │ │ binance │ │invoices │  ...      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Runtime:** Node.js 18+ (primary), Python 3.10+ (for ML-heavy skills)
- **Storage:** SQLite (local), optional PostgreSQL (scale)
- **Auth:** Custom auth-provider with OAuth2/OIDC
- **Events:** Redis Pub/Sub or NATS
- **Encryption:** libsodium (NaCl) for AES-256-GCM
- **CLI:** Commander.js with plugins

### Security
- Master key derived from user password (Argon2id)
- Credential encryption at rest
- No plaintext logging of secrets
- Skill sandboxing with restricted filesystem access
- Audit logging for all credential access

## Success Metrics

- **Development Velocity:** New skill created in <2 hours using SDK
- **Auth Consistency:** 100% of OAuth skills use auth-provider (no custom impl)
- **User Onboarding:** <5 minutes to activate a profile with all auth configured
- **Performance:** P95 skill response time <200ms
- **Reliability:** 99.9% skill health check pass rate
- **Adoption:** 50+ community-contributed skills within 6 months

## Implementation Phases

### Phase 1: Foundation (Month 1)
- US-001: Shared auth framework
- US-002: Unified skill runtime
- FR-1 through FR-8: Core infrastructure

### Phase 2: Core Skills (Month 2)
- All P0 skills for top 5 profiles:
  - Accountant: quickbooks, invoices, receipts, reports
  - Secretary: email, meetings, reminders, calendar ✅
  - Trader: binance ✅, alerts, portfolio, charts
  - Researcher: web-search, news-aggregator, summarizer ✅
  - Email Handler: inbox-triage, email-summarizer, draft-responses

### Phase 3: Platform & SDK (Month 3)
- US-003: Skill registry
- US-006: Development SDK
- US-007: Monitoring
- All remaining P0 and P1 skills

### Phase 4: Polish & Community (Month 4)
- P2 skills
- Documentation
- Community onboarding

## Open Questions

1. Should we support browser-based skill installation for non-technical users?
2. How do we handle skill versioning when dependencies update?
3. What's the policy for community-contributed skills (review process)?
4. Should we offer a hosted version of the auth provider?
5. How do we handle data backup/restore across all skills?
