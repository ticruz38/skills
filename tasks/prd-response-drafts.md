# PRD: Response Drafts

## Introduction

An AI-powered response drafting tool for Tim (Support) that generates personalized support responses based on KB articles, ticket context, and previous interactions. Provides multiple tone and solution options for agents to choose from and customize.

## Goals

- Generate accurate, helpful response drafts automatically
- Match tone to customer's communication style
- Integrate KB solutions seamlessly into responses
- Provide multiple response options for agents to choose
- Reduce time spent writing repetitive responses

## User Stories

### US-001: Auto-Draft Generation
**Description:** As a support agent, I want response drafts generated automatically so I can respond faster.

**Acceptance Criteria:**
- [ ] Generate draft when viewing ticket (after 2-second delay)
- [ ] Include greeting with customer name
- [ ] Reference relevant KB articles in response
- [ ] Provide clear solution steps
- [ ] Include appropriate closing
- [ ] Typecheck/lint passes

### US-002: Tone Matching
**Description:** As Tim (Support), I want responses to match the customer's tone (formal, casual, frustrated).

**Acceptance Criteria:**
- [ ] Analyze customer's message for tone indicators
- [ ] Adjust response formality accordingly
- [ ] Mirror customer's communication style appropriately
- [ ] Maintain empathy for frustrated/angry customers
- [ ] Keep brand voice consistent across all tones
- [ ] Typecheck/lint passes

### US-003: KB Integration
**Description:** As a support agent, I want relevant KB content automatically incorporated into drafts.

**Acceptance Criteria:**
- [ ] Auto-identify relevant KB articles
- [ ] Summarize and personalize KB content
- [ ] Include direct links to articles
- [ ] Quote specific sections when helpful
- [ ] Mark articles as "cited" for tracking
- [ ] Typecheck/lint passes

### US-004: Multiple Options
**Description:** As Tim (Support), I want multiple response options so I can choose the best approach.

**Acceptance Criteria:**
- [ ] Generate 3 distinct response variants
- [ ] Options vary in detail level (brief, standard, detailed)
- [ ] Options vary in approach (direct, educational, apologetic)
- [ ] Show key differences between options at a glance
- [ ] Allow mixing elements from different options
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Solution Suggestions
**Description:** As a support agent, I want the system to suggest solutions I might have missed.

**Acceptance Criteria:**
- [ ] Analyze ticket for common solution patterns
- [ ] Suggest additional troubleshooting steps
- [ ] Flag related issues that might be relevant
- [ ] Link to internal documentation or runbooks
- [ ] Highlight when escalation might be needed
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Generate response drafts based on ticket context and KB articles
- FR-2: Analyze and match customer's communication tone
- FR-3: Automatically integrate relevant KB solutions into responses
- FR-4: Provide 3 response variants with different tones/detail levels
- FR-5: Support custom response templates and snippets
- FR-6: Include customer name and ticket references automatically
- FR-7: Suggest additional solutions and troubleshooting steps
- FR-8: Track which drafts are used and modified
- FR-9: Learn from agent edits to improve future drafts
- FR-10: Support keyboard shortcuts for quick draft insertion

## Non-Goals

- No fully automated responses without agent review
- No responses generated from non-KB sources
- No real-time translation in v1
- No social media response support
- No voice/talk script generation

## Technical Considerations

- Use local LLM for fast draft generation
- Cache customer interaction history for tone analysis
- Implement streaming for real-time draft updates
- Store response templates in version-controlled format
- Rate limit generation to prevent abuse

## Success Metrics

- 70% of responses use AI-generated draft as starting point
- Average time to compose response reduced by 50%
- Agent satisfaction with draft quality >4/5
- Draft acceptance rate (used with <20% edits) >60%
- Customer satisfaction scores maintained or improved

## Open Questions

- Should agents be able to create custom response templates?
- How should we handle sensitive/compliance-related responses?
- Should we support collaborative draft editing?
