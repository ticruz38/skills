# PRD: Escalation Detector

## Introduction

A real-time monitoring system for Tim (Support) that detects tickets requiring escalation through sentiment analysis, keyword detection, and SLA tracking. Automatically alerts managers when human intervention is needed.

## Goals

- Detect frustrated, angry, or at-risk customers through sentiment analysis
- Identify escalation keywords and phrases
- Monitor SLA breach risks and alert proactively
- Notify managers immediately when escalation is needed
- Prevent issues from escalating further through early detection

## User Stories

### US-001: Sentiment Analysis
**Description:** As a support manager, I want to know when a customer is frustrated or angry so we can respond appropriately.

**Acceptance Criteria:**
- [ ] Analyze sentiment of each incoming message
- [ ] Score sentiment on scale: positive, neutral, negative, very negative
- [ ] Detect escalation in sentiment across conversation history
- [ ] Flag sudden negative sentiment shifts
- [ ] Consider customer history (repeat complaints)
- [ ] Typecheck/lint passes

### US-002: Keyword Detection
**Description:** As Tim (Support), I want the system to flag tickets containing escalation indicators.

**Acceptance Criteria:**
- [ ] Maintain list of escalation keywords ("lawsuit", "cancel", "manager", etc.)
- [ ] Detect urgency phrases ("immediately", "asap", "critical")
- [ ] Flag competitor mentions with frustration
- [ ] Identify refund/chargeback threats
- [ ] Support custom keywords per organization
- [ ] Typecheck/lint passes

### US-003: SLA Breach Alerts
**Description:** As a support manager, I want proactive alerts before SLA breaches occur.

**Acceptance Criteria:**
- [ ] Track time since ticket creation and last response
- [ ] Alert at 75% of SLA time elapsed
- [ ] Escalate alert at 90% of SLA time
- [ ] Consider priority level in SLA calculation
- [ ] Alert when SLA already breached
- [ ] Typecheck/lint passes

### US-004: Manager Notification
**Description:** As a support manager, I want immediate notification when escalation is detected.

**Acceptance Criteria:**
- [ ] Send real-time alert (Slack/email) on escalation trigger
- [ ] Include ticket summary and escalation reason
- [ ] Link directly to ticket for immediate action
- [ ] Batch non-urgent escalations into digest
- [ ] Track manager response time to escalations
- [ ] Typecheck/lint passes

### US-005: Escalation Dashboard
**Description:** As a support manager, I want a dashboard to monitor all potential escalations.

**Acceptance Criteria:**
- [ ] Display queue of tickets flagged for escalation
- [ ] Show escalation reason (sentiment, keywords, SLA)
- [ ] Sort by urgency/escalation score
- [ ] Mark tickets as handled or dismissed
- [ ] View escalation trends over time
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Perform real-time sentiment analysis on ticket messages
- FR-2: Detect escalation keywords and phrases with configurable lists
- FR-3: Monitor SLA timers and send proactive breach warnings
- FR-4: Calculate escalation score based on sentiment, keywords, and SLA status
- FR-5: Send immediate notifications to managers via Slack/email
- FR-6: Provide escalation dashboard with queue and metrics
- FR-7: Track escalation history and resolution outcomes
- FR-8: Support custom escalation rules per organization
- FR-9: Log all escalation decisions for audit purposes
- FR-10: Allow agents to manually flag tickets for escalation

## Non-Goals

- No automatic escalation without human review
- No sentiment analysis on attachments/images
- No voice call transcription in v1
- No predictive escalation (before customer expresses issue)
- No integration with external monitoring tools (PagerDuty, Opsgenie)

## Technical Considerations

- Use lightweight sentiment analysis model for real-time processing
- Implement webhook support for Slack/email notifications
- Store sentiment scores in ticket metadata
- Cache SLA configurations locally
- Support timezone-aware SLA calculations

## Success Metrics

- 95% of at-risk tickets flagged before SLA breach
- Average escalation response time <15 minutes
- False positive rate on escalation alerts <10%
- 80% of escalations detected through automated analysis
- Customer churn rate reduced by 15%

## Open Questions

- Should we support custom escalation workflows?
- How to handle timezone differences for global teams?
- Should sentiment analysis consider customer tenure/value?
