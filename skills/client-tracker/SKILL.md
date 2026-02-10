---
title: Client Tracker
skill_id: client-tracker
description: Track client payment behavior and history
version: 1.0.0
author: OpenClaw
---

## Overview

The Client Tracker skill provides comprehensive client relationship management with payment behavior tracking, credit risk scoring, and communication history.

## Features

- **Client Profiles**: Extended client information with payment statistics
- **Payment History**: Track all payments and invoices per client
- **Credit Risk Scoring**: Automated risk assessment based on payment patterns
- **Outstanding Balances**: Real-time balance tracking
- **Communication Log**: Record all client interactions

## Installation

```bash
cd skills/client-tracker
npm install
npm run build
```

## Usage

### CLI

```bash
# List all clients with summary
client-tracker list

# Get detailed client profile
client-tracker profile <client-id>

# View payment history
client-tracker payments <client-id>

# Check credit risk score
client-tracker risk <client-id>

# Add communication log entry
client-tracker log <client-id> "Discussed payment plan"

# View communication history
client-tracker communications <client-id>

# Get outstanding balances report
client-tracker balances

# Export client data
client-tracker export [path]

# Overall statistics
client-tracker stats
```

### Library

```typescript
import { ClientTrackerSkill } from '@openclaw/client-tracker';

const tracker = new ClientTrackerSkill();

// Get client with payment stats
const client = await tracker.getClientProfile(clientId);

// Check credit risk
const risk = await tracker.getRiskScore(clientId);

// Add communication log
await tracker.addCommunication(clientId, {
  type: 'call',
  content: 'Discussed payment schedule',
});
```

## Dependencies

- `@openclaw/invoices` - For client and invoice data
