# PRD: Complete OpenClaw Skills Ecosystem

## Introduction

Master reference document for implementing all 60+ skills across 17 professional profiles. This PRD defines the skill dependency graph, implementation order, and shared infrastructure requirements.

**Total Skills**: 60 across 17 profiles  
**Shared Infrastructure**: auth-provider, database, event-bus  
**Implementation Phases**: 4 phases over 3 months

## Goals

- Implement all 60 skills with consistent patterns
- Establish clear skill dependencies for proper build order
- Minimize code duplication through shared libraries
- Ensure all Google-dependent skills reuse google-oauth
- Achieve 80%+ test coverage across all skills

## Skill Dependency Graph

```
                           ┌─────────────────┐
                           │  auth-provider  │
                           │  (foundation)   │
                           └────────┬────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │ google-oauth│          │ binance-auth│          │  quickbooks │
   │  (OAuth)    │          │  (API Key)  │          │   (OAuth)   │
   └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
          │                        │                        │
    ┌─────┴─────┐                  │                        │
    │           │                  │                        │
    ▼           ▼                  ▼                        ▼
┌───────┐  ┌───────┐       ┌──────────┐           ┌──────────────┐
│ email │  │calendar│       │ binance  │           │   invoices   │
│       │  │        │       │  trader  │           │              │
└───┬───┘  └───┬───┘       └────┬─────┘           └──────┬───────┘
    │          │                 │                        │
    └────┬─────┘                 │                        │
         │                       │                        │
         ▼                       │                        │
    ┌─────────┐                  │                        │
    │meetings │                  │                        │
    │scheduler│                  │                        │
    └────┬────┘                  │                        │
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                                 │
                                 ▼
                        ┌─────────────┐
                        │  profiles   │
                        │  (bundles)  │
                        └─────────────┘
```

## Skills by Layer

### Layer 0: Foundation (Build First)
| Skill | Auth | Storage | Description |
|-------|------|---------|-------------|
| `auth-provider` | None | SQLite | Centralized auth management |
| `database` | None | SQLite | Shared data models |
| `event-bus` | None | SQLite/Local | Inter-skill communication |

### Layer 1: Auth Adapters (Build Second)
| Skill | Depends On | Auth Type | Description |
|-------|------------|-----------|-------------|
| `google-oauth` | auth-provider | OAuth 2.0 | Google services auth |
| `binance-auth` | auth-provider | API Key | Binance API auth |
| `quickbooks-auth` | auth-provider | OAuth 2.0 | QuickBooks auth |
| `openai-auth` | auth-provider | API Key | OpenAI API auth |
| `slack-auth` | auth-provider | Bot Token | Slack auth |

### Layer 2: Core Skills (Build Third)

#### Secretary Profile
| Skill | Depends On | Storage | External API |
|-------|------------|---------|--------------|
| `email` | google-oauth | SQLite | Gmail API |
| `calendar` | google-oauth | SQLite | Google Calendar |
| `meetings` | calendar, email | SQLite | None (uses deps) |
| `reminders` | None | SQLite | None (local) |
| `slack` | slack-auth | SQLite | Slack API |

#### Trader Profile
| Skill | Depends On | Storage | External API |
|-------|------------|---------|--------------|
| `binance` | binance-auth | SQLite | Binance API |
| `alerts` | binance | SQLite | Telegram/Slack |
| `portfolio` | binance | SQLite | Binance API |
| `charts` | binance | SQLite | Local generation |
| `technical-analysis` | binance | SQLite | Local calculation |

#### Accountant Profile
| Skill | Depends On | Storage | External API |
|-------|------------|---------|--------------|
| `quickbooks` | quickbooks-auth | SQLite | QuickBooks API |
| `invoices` | None | SQLite | Local PDF |
| `receipts-ocr` | google-oauth | SQLite | Google Vision |
| `reports` | quickbooks, receipts | SQLite | None (aggregates) |
| `tax-prep` | receipts, invoices | SQLite | None (local) |

#### Content Creator Profile
| Skill | Depends On | Storage | External API |
|-------|------------|---------|--------------|
| `content-writer` | openai-auth | SQLite | OpenAI API |
| `social-scheduler` | google-oauth | SQLite | YouTube, etc |
| `engagement-replies` | openai-auth | SQLite | OpenAI API |
| `image-prompts` | openai-auth | SQLite | OpenAI/DALL-E |
| `hashtag-research` | None | SQLite | Web scraping |

### Layer 3: Composite Skills (Build Fourth)

These skills combine multiple Layer 2 skills:

| Skill | Dependencies | Description |
|-------|--------------|-------------|
| `scheduler` | calendar, meetings, reminders | Complete scheduling system |
| `secretary` | email, calendar, meetings, reminders, slack | Full secretary suite |
| `trader` | binance, alerts, portfolio, charts | Complete trading setup |
| `accountant` | quickbooks, invoices, receipts, reports | Full accounting suite |

### Layer 4: Specialized Skills (Build Last)

#### Invoice Chaser
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `invoice-generator` | invoices | SQLite |
| `payment-reminders` | invoice-generator, email | SQLite |
| `client-tracker` | invoice-generator | SQLite |
| `payment-reconciliation` | invoice-generator | SQLite |
| `late-fee-calculator` | invoice-generator | SQLite |

#### Receipt Tracker
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `receipt-ocr` | google-oauth | SQLite |
| `expense-categorizer` | receipt-ocr | SQLite |
| `tax-export` | expense-categorizer | SQLite |
| `monthly-reports` | expense-categorizer | SQLite |
| `mileage-tracker` | None | SQLite |

#### Researcher
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `web-search` | None (or serper key) | SQLite |
| `news-aggregator` | None | SQLite |
| `competitor-monitor` | web-search | SQLite |
| `summarizer` | None (or openai) | SQLite |
| `saved-searches` | web-search | SQLite |

#### Email Handler
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `inbox-triage` | email | SQLite |
| `email-summarizer` | email, summarizer | SQLite |
| `draft-responses` | email, openai-auth | SQLite |
| `unsubscribe-helper` | email | SQLite |
| `follow-up-reminders` | email, reminders | SQLite |

#### Gift Guru
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `gift-suggestions` | openai-auth | SQLite |
| `occasion-reminders` | reminders | SQLite |
| `recipient-profiles` | None | SQLite |
| `gift-budget-tracker` | None | SQLite |
| `gift-wrapping-locator` | None | SQLite |

#### Meal Planner
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `recipe-suggester` | None (or spoonacular) | SQLite |
| `shopping-list-generator` | recipe-suggester | SQLite |
| `nutrition-tracker` | None | SQLite |
| `leftover-manager` | None | SQLite |
| `pantry-tracker` | None | SQLite |

#### Home Handyman
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `maintenance-scheduler` | reminders | SQLite |
| `appliance-tracker` | None | SQLite |
| `warranty-manager` | appliance-tracker | SQLite |
| `contractor-finder` | None | SQLite |
| `diy-guides` | None | SQLite |

#### Trip Planner
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `flight-search` | None (or amadeus) | SQLite |
| `hotel-finder` | None (or booking) | SQLite |
| `itinerary-builder` | flight-search, hotel | SQLite |
| `reservation-tracker` | email | SQLite |
| `local-guides` | None (or google places) | SQLite |

#### Realtor
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `property-alerts` | None (or zillow) | SQLite |
| `market-reports` | property-alerts | SQLite |
| `client-crm` | None | SQLite |
| `showing-scheduler` | calendar, reminders | SQLite |
| `offer-tracker` | client-crm | SQLite |

#### Analyst
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `data-connector` | google-oauth | SQLite |
| `chart-generator` | data-connector | SQLite |
| `report-builder` | data-connector, chart | SQLite |
| `trend-detector` | data-connector | SQLite |
| `forecasting` | data-connector | SQLite |

#### Restaurant
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `reservation-manager` | calendar | SQLite |
| `waitlist` | reservation-manager | SQLite |
| `specials-board` | None | SQLite |
| `review-monitor` | None (or yelp) | SQLite |
| `event-booking` | reservation-manager | SQLite |

#### Support
| Skill | Dependencies | Storage |
|-------|--------------|---------|
| `ticket-triage` | None (or zendesk) | SQLite |
| `kb-search` | None | SQLite |
| `response-drafts` | openai-auth | SQLite |
| `escalation-detector` | ticket-triage | SQLite |
| `satisfaction-tracker` | ticket-triage | SQLite |

## Implementation Order

### Phase 1: Foundation (Week 1)
1. `auth-provider` - Centralized authentication
2. `database` - Shared SQLite schema
3. `event-bus` - Inter-skill communication

### Phase 2: Auth Adapters (Week 2)
4. `google-oauth` - For all Google services
5. `binance-auth` - For trading skills
6. `openai-auth` - For AI-powered skills
7. `slack-auth` - For Slack integration

### Phase 3: Core Skills (Weeks 3-4)

**Secretary Profile:**
8. `email` (depends: google-oauth)
9. `calendar` (depends: google-oauth)
10. `reminders` (no deps)
11. `meetings` (depends: calendar, email)
12. `slack` (depends: slack-auth)

**Trader Profile:**
13. `binance` (depends: binance-auth)
14. `alerts` (depends: binance)
15. `portfolio` (depends: binance)

**Accountant Profile:**
16. `invoices` (no deps)
17. `receipts-ocr` (depends: google-oauth)
18. `quickbooks` (depends: quickbooks-auth)

**Content Creator:**
19. `content-writer` (depends: openai-auth)
20. `social-scheduler` (depends: google-oauth)

### Phase 4: Specialized Skills (Weeks 5-8)

Build remaining 40 skills following dependency order.

## Shared Libraries

All skills should use these shared modules:

```
skills/
├── _shared/                    # Internal shared libraries
│   ├── __init__.py
│   ├── auth.py                 # Auth provider client
│   ├── database.py             # SQLite helpers
│   ├── events.py               # Event bus client
│   ├── google_client.py        # Reusable Google OAuth
│   └── pdf.py                  # PDF generation helpers
│
├── auth-provider/              # Layer 0
├── google-oauth/               # Layer 1
├── email/                      # Layer 2
└── ...
```

## Skill Template

Each skill follows this structure:

```
skills/[skill-name]/
├── SKILL.md              # Documentation + metadata
├── onboard.yaml          # Configuration questions
├── [entry].py            # Main script (Python/Node/Bash)
├── requirements.txt      # Python dependencies
└── lib/                  # Skill-specific modules
```

## Dependency Declaration

In `SKILL.md` frontmatter:

```yaml
---
name: email
description: "Gmail integration"
depends_on:
  - google-oauth
  - database
---
```

In `onboard.yaml`:

```yaml
dependencies:
  required:
    - skill: google-oauth
      reason: "Required for Gmail API access"
    - skill: database
      reason: "Stores email cache"
  optional:
    - skill: summarizer
      reason: "For email summarization feature"
```

## Testing Strategy

1. **Unit Tests**: Each skill in isolation
2. **Integration Tests**: Skills with their dependencies
3. **End-to-End**: Full profile activation

## Success Metrics

- All 60 skills implemented
- 100% of Google-dependent skills use google-oauth
- Zero duplicate OAuth implementations
- Average skill size <500 lines of code
- All skills pass health check

## Open Questions

1. Should we auto-install dependencies or prompt user?
2. How to handle version conflicts between skill dependencies?
3. What's the rollback strategy if a dependency skill fails?
4. Should skills cache data locally or always fetch fresh?
5. How to handle rate limits across multiple skills using same API?
