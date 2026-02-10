# PRD: DIY Guides

## Introduction

A comprehensive DIY repair guide system for Hank the Home Handyman to access step-by-step instructions for common home repairs. Each guide includes tools needed, difficulty ratings, video links, and detailed instructions to help Hank complete repairs confidently.

## Goals

- Provide a library of common home repair guides
- Rate difficulty to help users choose appropriate projects
- List required tools and materials upfront
- Include video tutorials where available
- Enable users to track progress through multi-step repairs

## User Stories

### US-001: Browse DIY guides
**Description:** As Hank, I want to browse repair guides by category so I can find help for my project.

**Acceptance Criteria:**
- [ ] Categories: Plumbing, Electrical, HVAC, Carpentry, Painting, Appliances, Outdoor, Automotive
- [ ] Grid view with thumbnail, title, difficulty, estimated time
- [ ] Filter by: difficulty (beginner/intermediate/advanced), time required, tools needed
- [ ] Search by keyword (e.g., "leaky faucet", "outlet replacement")
- [ ] Popular/trending guides section
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: View guide details
**Description:** As Hank, I want to see detailed step-by-step instructions for a repair.

**Acceptance Criteria:**
- [ ] Header: title, difficulty badge, estimated time, cost estimate
- [ ] Tools and materials list with checkboxes
- [ ] Step-by-step instructions with photos
- [ ] Safety warnings highlighted prominently
- [ ] Tips and troubleshooting section
- [ ] Related guides section
- [ ] Print-friendly view
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Video tutorial integration
**Description:** As Hank, I want to watch video tutorials alongside written instructions.

**Acceptance Criteria:**
- [ ] Embedded video player for YouTube/Vimeo links
- [ ] Video timestamp links to specific steps
- [ ] Full-screen and picture-in-picture support
- [ ] Video quality selection
- [ ] Captions/subtitles if available
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Track repair progress
**Description:** As Hank, I want to track my progress through a repair so I know where I left off.

**Acceptance Criteria:**
- [ ] Checkbox to mark each step complete
- [ ] Progress bar showing completion percentage
- [ ] Auto-save progress to account
- [ ] Resume from last completed step
- [ ] Reset progress to start over
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Save favorite guides
**Description:** As Hank, I want to save guides for quick access to repairs I do frequently.

**Acceptance Criteria:**
- [ ] "Save to Favorites" button on each guide
- [ ] "My Guides" section with saved items
- [ ] Organize favorites into custom collections (e.g., "Bathroom Projects")
- [ ] Quick access from dashboard
- [ ] Remove from favorites option
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Database schema for guides with fields: id, title, category, difficulty (beginner/intermediate/advanced), estimated_time, cost_estimate, tools_required[], materials[], steps[], safety_warnings[], video_url, images[], tags[]
- FR-2: Category browsing with filtering by difficulty and time
- FR-3: Search functionality across title, description, tags, tools
- FR-4: Detail view with structured step-by-step presentation
- FR-5: Video embedding with timestamp linking
- FR-6: Progress tracking with step completion persistence
- FR-7: Favorites system with custom collections
- FR-8: Print-friendly CSS for guide output
- FR-9: Rating system for guide helpfulness

## Non-Goals

- No user-generated guides (admin-curated content only)
- No real-time chat or expert assistance
- No shopping integration for tool/material purchase
- No AR/VR guided repair features
- No community forum or Q&A

## Technical Considerations

- Image optimization for fast loading of guide photos
- Video embedding must respect privacy settings
- Mobile-responsive design for in-garage/onsite reference
- Offline mode support for saved guides
- Content versioning for guide updates

## Success Metrics

- Guide loads within 2 seconds including images
- User can find relevant guide via search in under 30 seconds
- 80%+ of users who start a guide view all steps
- Average guide rating of 4+ stars

## Open Questions

- Should we support offline download of guides?
- Should there be a "request a guide" feature for missing repairs?
- Should we integrate with tool rental locations?
