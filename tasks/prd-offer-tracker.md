# PRD: Offer Tracker

## Introduction

Help Realtor Owen manage offers and negotiations across multiple properties and clients. The Offer Tracker provides a centralized view of all active offers, compares terms side-by-side, tracks counter-offers and deadlines, and organizes related documents. This ensures no detail is missed during critical negotiation phases and helps Owen advise clients on the best course of action.

## Goals

- Track all offers and their status in a centralized dashboard
- Compare multiple offers side-by-side for easy decision-making
- Monitor counter-offer sequences and negotiation history
- Alert on critical deadlines (inspection, financing, closing)
- Organize offer documents and correspondence

## User Stories

### US-001: Create New Offer
**Description:** As Owen, I want to create a new offer record so that I can track its progress through negotiation.

**Acceptance Criteria:**
- [ ] Link offer to client and property from CRM/alerts
- [ ] Record offer details: price, earnest money, down payment
- [ ] Financing type (cash, conventional, FHA, VA, etc.)
- [ ] Contingencies: inspection, financing, appraisal, sale of home
- [ ] Proposed closing date and possession date
- [ ] Special terms or requests (repairs, appliances, etc.)
- [ ] Set offer expiration date/time
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Track Offer Status
**Description:** As Owen, I want to update and track offer status so that I know where each offer stands.

**Acceptance Criteria:**
- [ ] Status workflow: Draft, Submitted, Under Review, Countered, Accepted, Rejected, Withdrawn
- [ ] Status change with timestamp and note
- [ ] Visual pipeline view of all active offers
- [ ] Filter by status, client, or property
- [ ] Activity log showing all status changes
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Record Counter-Offer
**Description:** As Owen, I want to record a counter-offer so that I can track the negotiation sequence.

**Acceptance Criteria:**
- [ ] Create counter-offer linked to original offer
- [ ] Record counter terms: price, contingencies, dates
- [ ] View full negotiation history as threaded conversation
- [ ] Compare original vs counter side-by-side
- [ ] Set response deadline for counter
- [ ] Notify client of counter-offer details
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Compare Multiple Offers
**Description:** As Owen, I want to compare multiple offers on the same property so that I can advise my seller client.

**Acceptance Criteria:**
- [ ] Select multiple offers for comparison
- [ ] Side-by-side table: price, financing, contingencies, timeline
- [ ] Net proceeds calculation for seller
- [ ] Risk assessment indicators (cash vs financed, waived contingencies)
- [ ] Sort by different criteria (price, certainty, timeline)
- [ ] Export comparison as PDF
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Deadline Alerts
**Description:** As Owen, I want to receive alerts for upcoming deadlines so that nothing falls through the cracks.

**Acceptance Criteria:**
- [ ] Track key dates: inspection deadline, financing contingency, closing date
- [ ] Alert 48 hours, 24 hours, and day-of for each deadline
- [ ] Dashboard widget showing upcoming deadlines
- [ ] Mark deadlines as completed with note
- [ ] Escalate overdue items
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Document Management
**Description:** As Owen, I want to attach documents to an offer so that all paperwork is organized.

**Acceptance Criteria:**
- [ ] Upload purchase agreement, pre-approval letters, proof of funds
- [ ] Organize documents by category
- [ ] Version control for revised documents
- [ ] Download all documents as ZIP
- [ ] Share documents securely with client or listing agent
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create offer records with price, financing, contingencies, dates
- FR-2: Status workflow: Draft → Submitted → Under Review → Countered → Accepted/Rejected/Withdrawn
- FR-3: Track multiple counter-offers with negotiation history
- FR-4: Compare up to 5 offers side-by-side with financial analysis
- FR-5: Calculate estimated net proceeds for seller clients
- FR-6: Deadline tracking: inspection, financing, appraisal, closing
- FR-7: Multi-level alerts: 48hr, 24hr, day-of, overdue
- FR-8: Document upload with categorization
- FR-9: Version control for revised offer documents
- FR-10: Pipeline view of all offers by status
- FR-11: Link offers to clients in CRM and properties in alerts
- FR-12: Export offer summary and comparison as PDF

## Non-Goals

- No e-signature functionality (use DocuSign, HelloSign)
- No automated offer submission to MLS or listing agents
- No escrow or earnest money handling
- No automated negotiation suggestions or AI pricing
- No transaction coordination beyond offer acceptance

## Technical Considerations

- Document storage with encryption (AWS S3, Google Cloud Storage)
- PDF generation for offer comparisons
- Calendar integration for deadline tracking
- Email notifications for status changes and deadline alerts
- Audit logging for all offer modifications
- Role-based access (Owen only, no client direct access)
- Integration with CRM for client data

## Success Metrics

- 100% of offers tracked within 1 hour of submission
- Zero missed deadlines due to tracking errors
- Average time to compare multiple offers under 5 minutes
- All offer documents organized and accessible within 10 seconds
- Client satisfaction with offer management >4.5/5

## Open Questions

- Should we integrate with e-signature platforms (DocuSign, HelloSign)?
- Do we need automated CMA (Comparative Market Analysis) generation?
- Should we track competing offers from other agents?
- Do we need integration with transaction management systems for post-acceptance?
