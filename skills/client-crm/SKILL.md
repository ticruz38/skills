---
title: Client CRM
skill_id: client-crm
description: Real estate client relationship management with contact profiles, property preferences, communication history, and pipeline tracking
tags: [real-estate, crm, clients, contacts, sales]
---

# Client CRM

Real estate client relationship management for tracking buyers, sellers, and prospects.

## Features

- Contact profiles with detailed information
- Property preferences (type, location, price range, features)
- Communication history tracking
- Sales pipeline stages (lead → qualified → viewing → offer → closed)
- Lead source tracking
- Urgency and status levels
- Notes and follow-up dates
- Import/export capabilities

## Usage

```typescript
import { ClientCRMSkill } from '@openclaw/client-crm';

const crm = new ClientCRMSkill();

// Add a new client
const client = await crm.addClient({
  name: 'John & Jane Smith',
  email: 'smith@example.com',
  phone: '555-123-4567',
  type: 'buyer',
  source: 'referral',
  notes: 'Looking for family home in Austin area'
});

// Set property preferences
await crm.setPreferences(client.id!, {
  minPrice: 400000,
  maxPrice: 600000,
  minBedrooms: 3,
  minBathrooms: 2,
  locations: ['Austin, TX', 'Round Rock, TX'],
  propertyTypes: ['house', 'townhouse'],
  mustHaveFeatures: ['garage', 'backyard', 'good schools']
});

// Move through pipeline
await crm.updatePipelineStage(client.id!, 'qualified');

// Log communication
await crm.addCommunication(client.id!, {
  type: 'meeting',
  content: 'Initial consultation at office. Discussed budget and timeline.'
});

// Get upcoming follow-ups
const followUps = await crm.getUpcomingFollowUps(7); // Next 7 days
```

## CLI

```bash
# Client management
client-crm add --name "John Smith" --email "john@example.com" --type buyer
client-crm list --type buyer --stage qualified
client-crm get <id>
client-crm update <id> --stage viewing
client-crm delete <id>

# Preferences
client-crm preferences <id> --min-price 400000 --max-price 600000 --beds 3
client-crm preferences-get <id>

# Pipeline
client-crm pipeline <id> --stage offer
client-crm pipeline-list

# Communications
client-crm log <id> --type call --content "Discussed new listings"
client-crm communications <id>

# Follow-ups
client-crm follow-ups --days 7
client-crm set-follow-up <id> --date "2026-03-01" --notes "Schedule showings"

# Search
client-crm search "John"
client-crm by-location "Austin"
client-crm by-feature "pool"

# Import/Export
client-crm import --file contacts.csv
client-crm export --file clients.csv

# Stats
client-crm stats
client-crm health
```

## Pipeline Stages

1. **lead** - Initial inquiry
2. **qualified** - Budget/timeline verified
3. **viewing** - Actively viewing properties
4. **offer** - Made/considering an offer
5. **under_contract** - Accepted offer, in escrow
6. **closed** - Transaction complete
7. **archived** - Inactive/no longer working together

## Client Types

- **buyer** - Looking to purchase
- **seller** - Looking to sell
- **renter** - Looking to rent
- **investor** - Investment property buyer
- **vendor** - Service provider/vendor
- **other** - Miscellaneous contacts
