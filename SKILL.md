# Skills Specification for clawd-cli

**Repository:** `https://github.com/ticruz38/skills`

**Installation command:** `npx skills add https://github.com/ticruz38/skills --skill [skill-name]`

---

## Profile Skill Requirements

### Existing Profiles

#### Accountant (Benny)
| Skill | Description | Priority |
|-------|-------------|----------|
| `quickbooks` | QuickBooks Online integration for sync | P0 |
| `invoices` | Create, send, and track invoices | P0 |
| `receipts` | Receipt OCR and data extraction | P0 |
| `reports` | Generate P&L, balance sheet, cash flow | P0 |
| `tax-prep` | Tax document preparation and export | P1 |

#### Secretary (Terry)
| Skill | Description | Priority |
|-------|-------------|----------|
| `calendar` | Google/Outlook calendar management | P0 |
| `email` | Gmail/Outlook email handling | P0 |
| `slack` | Slack integration for notifications | P1 |
| `meetings` | Meeting scheduling and prep | P0 |
| `reminders` | Follow-up and task reminders | P0 |

#### Trader (already have: skills-binance, skills-alerts, etc.)
| Skill | Description | Priority |
|-------|-------------|----------|
| `binance` | Binance API integration (read-only) | P0 |
| `alerts` | Price alert system | P0 |
| `charts` | Chart generation and technical analysis | P0 |
| `technical-analysis` | TA indicators and patterns | P1 |
| `portfolio` | Portfolio tracking and P&L | P0 |

---

### New Profiles

#### Content Creator (Casey)
| Skill | Description | Priority |
|-------|-------------|----------|
| `content-writer` | Write posts, blogs, captions in user voice | P0 |
| `social-scheduler` | Schedule posts to LinkedIn, Twitter, etc. | P0 |
| `engagement-replies` | Draft replies to comments/DMs | P1 |
| `image-prompts` | Generate prompts for AI image tools | P1 |
| `hashtag-research` | Find trending and relevant hashtags | P2 |

#### Invoice Chaser (Chase)
| Skill | Description | Priority |
|-------|-------------|----------|
| `invoice-generator` | Create professional invoices | P0 |
| `payment-reminders` | Send polite/firm payment reminders | P0 |
| `client-tracker` | Track client payment history | P0 |
| `payment-reconciliation` | Match payments to invoices | P1 |
| `late-fee-calculator` | Calculate and apply late fees | P1 |

#### Receipt Tracker (Rex)
| Skill | Description | Priority |
|-------|-------------|----------|
| `receipt-ocr` | Extract data from receipt photos | P0 |
| `expense-categorizer` | Auto-categorize expenses | P0 |
| `tax-export` | Export expenses for tax filing | P0 |
| `monthly-reports` | Generate monthly expense summaries | P1 |
| `mileage-tracker` | Track business mileage | P2 |

#### Researcher (Russ)
| Skill | Description | Priority |
|-------|-------------|----------|
| `web-search` | Search web for information | P0 |
| `news-aggregator` | Collect news from RSS/feeds | P0 |
| `competitor-monitor` | Track competitor websites/changes | P0 |
| `summarizer` | Summarize articles and reports | P0 |
| `saved-searches` | Run and save recurring searches | P1 |

#### Email Handler (Ian)
| Skill | Description | Priority |
|-------|-------------|----------|
| `inbox-triage` | Sort and prioritize emails | P0 |
| `email-summarizer` | Summarize long threads | P0 |
| `draft-responses` | Draft reply options | P0 |
| `unsubscribe-helper` | Identify and unsubscribe from lists | P1 |
| `follow-up-reminders` | Remind about emails needing replies | P1 |

#### Gift Guru (Gigi)
| Skill | Description | Priority |
|-------|-------------|----------|
| `gift-suggestions` | Suggest personalized gifts | P0 |
| `occasion-reminders` | Birthday/anniversary reminders | P0 |
| `recipient-profiles` | Store preferences and history per person | P0 |
| `budget-tracker` | Track gift spending | P1 |
| `gift-wrapping-locator` | Find local gift services | P2 |

#### Meal Planner (Chip)
| Skill | Description | Priority |
|-------|-------------|----------|
| `recipe-suggester` | Suggest recipes based on preferences | P0 |
| `shopping-list-generator` | Generate organized shopping lists | P0 |
| `nutrition-tracker` | Track macros and calories | P2 |
| `leftover-manager` | Suggest uses for leftovers | P1 |
| `pantry-tracker` | Track what you have on hand | P1 |

#### Home Handyman (Hank)
| Skill | Description | Priority |
|-------|-------------|----------|
| `maintenance-scheduler` | Schedule recurring maintenance | P0 |
| `appliance-tracker` | Track appliances and manuals | P0 |
| `warranty-manager` | Store and alert on warranties | P1 |
| `contractor-finder` | Find and vet local contractors | P1 |
| `diy-guides` | Provide step-by-step repair guides | P1 |

#### Trip Planner (Tina)
| Skill | Description | Priority |
|-------|-------------|----------|
| `flight-search` | Search and compare flights | P0 |
| `hotel-finder` | Find and compare accommodations | P0 |
| `itinerary-builder` | Build day-by-day itineraries | P0 |
| `reservation-tracker` | Track all booking confirmations | P0 |
| `local-guides` | Suggest restaurants and activities | P1 |

---

## Frontend-Defined Profiles (Already in UI)

#### Realtor (Owen)
| Skill | Description | Priority |
|-------|-------------|----------|
| `property-alerts` | Monitor listings matching criteria | P0 |
| `market-reports` | Local market trend reports | P0 |
| `client-crm` | Track client preferences and timeline | P0 |
| `showing-scheduler` | Schedule property showings | P0 |
| `offer-tracker` | Track offers and negotiations | P1 |

#### Analyst (Barry)
| Skill | Description | Priority |
|-------|-------------|----------|
| `data-connector` | Connect to data sources (Sheets, Airtable) | P0 |
| `chart-generator` | Create charts and visualizations | P0 |
| `report-builder` | Build automated reports | P0 |
| `trend-detector` | Identify patterns in data | P1 |
| `forecasting` | Simple projections and forecasting | P2 |

#### Restaurant (Sergio)
| Skill | Description | Priority |
|-------|-------------|----------|
| `reservation-manager` | Handle booking requests | P0 |
| `waitlist` | Manage waitlist and table turns | P0 |
| `specials-board` | Daily menu/specials updates | P1 |
| `review-monitor` | Monitor and respond to reviews | P1 |
| `event-booking` | Private dining and events | P2 |

#### Support (Tim)
| Skill | Description | Priority |
|-------|-------------|----------|
| `ticket-triage` | Categorize and route tickets | P0 |
| `kb-search` | Search knowledge base for answers | P0 |
| `response-drafts` | Draft support responses | P0 |
| `escalation-detector` | Detect when to escalate | P1 |
| `satisfaction-tracker` | Track CSAT and feedback | P1 |

#### Scheduler (Terry - overlaps with Secretary)
| Skill | Description | Priority |
|-------|-------------|----------|
| `calendar-optimization` | Find optimal meeting times | P0 |
| `buffer-time` | Auto-add buffer between meetings | P0 |
| `focus-time-blocks` | Protect deep work time | P1 |
| `scheduling-links` | Generate booking links | P0 |
| `timezone-handler` | Handle multi-timezone scheduling | P1 |

---

## Skill Naming Conventions

All skills should follow the pattern:
```
skills/[skill-name]
```

Examples:
- `skills/invoice-generator`
- `skills/calendar`
- `skills/receipt-ocr`

This maps to installation:
```bash
npx skills add https://github.com/ticruz38/skills --skill invoice-generator
```

---

## Skill Directory Structure

Each skill in the repo should have:
```
skills/
├── [skill-name]/
│   ├── skill.yaml          # Skill metadata
│   ├── index.js            # Main entry point
│   ├── README.md           # Documentation
│   └── package.json        # Dependencies
```

---

## Total Skills Needed: 60

**By Priority:**
- P0 (Critical): 35 skills
- P1 (Important): 20 skills  
- P2 (Nice-to-have): 15 skills

**Implementation Order:**
1. Create all P0 skills first (minimum viable product)
2. Add P1 skills for feature completeness
3. Add P2 skills for polish

---

## Installation Reference

```bash
# Single skill
npx skills add https://github.com/ticruz38/skills --skill invoice-generator

# Multiple skills
npx skills add https://github.com/ticruz38/skills --skill invoice-generator
npx skills add https://github.com/ticruz38/skills --skill payment-reminders

# With version tag
npx skills add https://github.com/ticruz38/skills --skill invoice-generator --version 1.2.0
```
