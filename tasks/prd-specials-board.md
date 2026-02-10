# PRD: Specials Board

## Introduction

A daily menu and specials management system for Sergio's Restaurant that enables quick menu updates, daily specials creation, dietary tagging, pricing adjustments, and automatic social media post generation to promote featured items.

## Goals

- Streamline daily menu updates and specials creation
- Ensure accurate dietary and allergen information is clearly communicated
- Enable rapid price adjustments for market-priced items
- Automate social media promotion of daily specials
- Maintain consistency between in-house menu and online presence

## User Stories

### US-001: Create daily special
**Description:** As a chef, I want to create daily specials so guests can discover new and seasonal menu items.

**Acceptance Criteria:**
- [ ] Form captures dish name, description, price, category (appetizer/entree/dessert), and availability quantity
- [ ] Upload dish photo for digital displays and social media
- [ ] Mark availability: all day, lunch only, dinner only, limited quantity
- [ ] Auto-archive at end of day or when quantity reaches zero
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Edit menu items
**Description:** As a manager, I want to edit existing menu items so the menu reflects current offerings and pricing.

**Acceptance Criteria:**
- [ ] Modify name, description, price, category, and availability status
- [ ] Toggle items active/inactive without deletion
- [ ] Price history tracking for reporting
- [ ] Edit requires manager authorization for price increases >10%
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Add dietary tags
**Description:** As a chef, I want to tag menu items with dietary information so guests can make informed choices.

**Acceptance Criteria:**
- [ ] Tags: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Spicy, Halal, Kosher
- [ ] Allergen warnings: Shellfish, Tree Nuts, Peanuts, Soy, Eggs, Dairy, Wheat, Fish
- [ ] Tags display on menu boards and digital displays
- [ ] Filter menu view by dietary preference
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Update pricing
**Description:** As a manager, I want to update item prices so the menu reflects current costs and market rates.

**Acceptance Criteria:**
- [ ] Individual item price updates with effective date
- [ ] Bulk price updates by category (e.g., increase all appetizers 5%)
- [ ] Price change requires confirmation and manager authorization
- [ ] Historical price data retained for analysis
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Generate social media post
**Description:** As a manager, I want to auto-generate social media posts for specials so we can promote them efficiently.

**Acceptance Criteria:**
- [ ] Generate Instagram/Facebook post with dish photo, name, description, and price
- [ ] Pre-written caption templates with customizable hashtags
- [ ] One-click copy to clipboard or direct post integration
- [ ] Schedule posts for optimal times (11am lunch, 5pm dinner)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Display digital menu board
**Description:** As a host, I want to display today's menu and specials on screens so guests see current offerings while waiting.

**Acceptance Criteria:**
- [ ] Full-screen display mode for TV/monitor mounting
- [ ] Auto-rotate through categories: appetizers, mains, specials, desserts
- [ ] Visual highlighting for today's specials
- [ ] Dietary icons visible on each item
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Manage 86 list
**Description:** As a server, I want to mark items as "86'd" (sold out) so guests can't order unavailable dishes.

**Acceptance Criteria:**
- [ ] One-click 86 toggle on any menu item
- [ ] 86 status syncs immediately to all displays and POS
- [ ] Reason capture: sold out, kitchen issue, ingredient shortage
- [ ] Auto-reset 86 list at end of service day
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Menu item structure: name, description, price, category, photo, dietary tags, allergens
- FR-2: Categories: Appetizers, Salads, Entrees, Pasta, Seafood, Steaks, Sides, Desserts, Beverages
- FR-3: Daily specials automatically expire at restaurant closing time
- FR-4: Dietary tags display as icons with hover/click for full description
- FR-5: Price format supports currency symbol, decimals, and "Market Price" option
- FR-6: Social media posts generated in 1080x1080 format optimized for Instagram
- FR-7: Digital display mode refreshes every 60 seconds with smooth transitions
- FR-8: 86'd items remain visible but marked unavailable (not hidden)
- FR-9: Menu change audit log tracks who made changes and when
- FR-10: Seasonal menu templates for quick menu rotation (spring/summer/fall/winter)
- FR-11: Export menu to PDF for printing or external websites
- FR-12: Wine pairing suggestions can be linked to entrees

## Non-Goals

- No POS system integration for automatic inventory deduction
- No online ordering or delivery menu management
- No QR code menu generation for table scanning
- No nutritional information or calorie counting
- No multi-language menu support
- No integration with third-party delivery platforms (DoorDash, UberEats)

## Design Considerations

- Menu display uses high-contrast text for readability on screens
- Dietary icons are internationally recognized symbols
- Photo uploads automatically cropped to 1:1 ratio for consistency
- Digital board uses dark background (easier on eyes, looks premium)
- Specials highlighted with distinct color accent

## Success Metrics

- Daily specials updated in under 2 minutes from kitchen decision
- 100% of menu items with dietary tags have accurate allergen info
- Social media posts generated and shared within 5 minutes of special creation
- Zero guest complaints about ordering 86'd items after marking
- Menu price updates reflected on digital displays within 30 seconds

## Open Questions

- Should we track ingredient costs for margin analysis?
- Do we need "chef's recommendation" or "most popular" badges?
- Should guests be able to filter the menu by multiple dietary tags simultaneously?
- How should we handle "market price" items that need daily updates?
