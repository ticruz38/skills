# PRD: Ticket Triage

## Introduction

An intelligent ticket classification and routing system for Tim (Support) that automatically categorizes incoming support tickets, assigns priority levels, routes to appropriate agents, and filters spam. This reduces manual triage time and ensures tickets reach the right people quickly.

## Goals

- Automatically classify tickets by category (billing, technical, account, etc.)
- Assign priority levels (P0-P3) based on content and customer context
- Route tickets to appropriate support agents or teams
- Filter spam and low-quality submissions before they reach the queue
- Reduce average triage time from minutes to seconds

## User Stories

### US-001: Category Detection
**Description:** As a support agent, I want tickets automatically categorized so I can focus on solving issues instead of sorting them.

**Acceptance Criteria:**
- [ ] System analyzes ticket subject and body to detect category
- [ ] Supported categories: Billing, Technical, Account, Feature Request, General Inquiry
- [ ] Category confidence score displayed (>80% for auto-assignment)
- [ ] Manual category override available
- [ ] Typecheck/lint passes

### US-002: Priority Classification
**Description:** As a support manager, I want tickets automatically prioritized so critical issues get immediate attention.

**Acceptance Criteria:**
- [ ] P0 (Critical): System down, data loss, security breach keywords detected
- [ ] P1 (High): Major functionality broken, enterprise customer affected
- [ ] P2 (Medium): Partial issues, standard customers
- [ ] P3 (Low): Feature requests, general questions
- [ ] Enterprise customer flag increases priority by one level
- [ ] Typecheck/lint passes

### US-003: Auto-Assignment
**Description:** As a support agent, I want tickets routed to the right team member based on workload and expertise.

**Acceptance Criteria:**
- [ ] Route by category (billing → billing team, technical → tech team)
- [ ] Consider agent workload (active ticket count)
- [ ] Respect agent expertise/specialization tags
- [ ] Round-robin fallback for unassigned categories
- [ ] Escalate to manager if no agents available
- [ ] Typecheck/lint passes

### US-004: Spam Filtering
**Description:** As a support team, I want spam and low-quality tickets filtered out so we don't waste time on them.

**Acceptance Criteria:**
- [ ] Detect obvious spam patterns (URLs, repetitive content)
- [ ] Flag tickets with <10 characters as "needs more info"
- [ ] Move spam to quarantine folder for review
- [ ] Auto-close tickets with profanity or abuse
- [ ] Maintain spam detection accuracy >95%
- [ ] Typecheck/lint passes

### US-005: Triage Dashboard
**Description:** As Tim (Support), I want a dashboard to review and adjust auto-triage decisions.

**Acceptance Criteria:**
- [ ] Display queue of unclassified tickets
- [ ] Show AI-suggested category, priority, and assignee
- [ ] One-click approve or edit suggestions
- [ ] Bulk approve option for high-confidence matches
- [ ] Feedback loop to improve classification accuracy
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Analyze ticket content using NLP for category classification
- FR-2: Assign priority based on keywords, customer tier, and issue severity
- FR-3: Route tickets to agents based on category, workload, and expertise
- FR-4: Filter spam using pattern matching and content analysis
- FR-5: Provide confidence scores for all automated decisions
- FR-6: Allow manual override of all auto-triage fields
- FR-7: Track triage accuracy metrics (category match %, priority accuracy)
- FR-8: Support bulk triage operations for high-volume periods
- FR-9: Integrate with Zendesk/Help Scout API for ticket updates
- FR-10: Maintain audit log of all triage decisions and changes

## Non-Goals

- No automatic response generation (covered in response-drafts)
- No sentiment analysis (covered in escalation-detector)
- No customer-facing changes or notifications
- No multi-language support in v1
- No custom category creation by users

## Technical Considerations

- Use lightweight NLP model for real-time classification
- Cache agent availability and workload data
- Rate limit API calls to Zendesk/Help Scout
- Store classification models locally for speed
- Implement retry logic for failed API updates

## Success Metrics

- 90% of tickets correctly categorized (manual review sampling)
- 95% of P0/P1 tickets identified within 30 seconds
- Average triage time reduced from 3 minutes to 10 seconds
- Spam detection accuracy >95% (false positive rate <2%)
- Agent satisfaction with routing >4/5

## Open Questions

- Should we support custom categories per organization?
- How to handle tickets that span multiple categories?
- Should VIP customers bypass normal triage queue?
