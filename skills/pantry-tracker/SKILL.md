---
title: Pantry Tracker
skill_id: pantry-tracker
description: Track pantry inventory with barcode scanning, expiration dates, and low stock alerts
category: home
tags: [pantry, inventory, food, groceries, tracking, expiration]
version: 1.0.0
author: OpenClaw
---

## Overview

Pantry Tracker is a comprehensive inventory management system for tracking food and household items. It supports barcode scanning (manual entry), expiration date tracking, low stock alerts, and automatic shopping list generation.

## Features

- **Barcode Scanning**: Track items by barcode for quick lookup and restocking
- **Quantity Tracking**: Monitor exact quantities with customizable units
- **Expiration Dates**: Track expiration dates with automatic alerts
- **Low Stock Alerts**: Get notified when items fall below threshold
- **Shopping List**: Auto-generate shopping lists from low stock and expired items
- **Categories**: Organize items by category (produce, dairy, pantry, etc.)
- **Search**: Find items by name, barcode, or notes

## Installation

```bash
cd skills/pantry-tracker
npm install
npm run build
```

## Usage

### CLI Commands

```bash
# Check status
npx pantry-tracker status

# Add items
npx pantry-tracker add "Milk" -q 2 -u gallon -c dairy -e 2026-02-15
npx pantry-tracker add "Eggs" -q 12 -u count -c dairy --threshold 3

# Scan barcode (auto-restock if exists)
npx pantry-tracker scan 123456789 "Organic Milk" -q 1 -c dairy

# List items
npx pantry-tracker list
npx pantry-tracker list --category produce
npx pantry-tracker list --low-stock

# View details
npx pantry-tracker get 5

# Update items
npx pantry-tracker update 5 --quantity 3 --expires 2026-03-01

# Consume/restock
npx pantry-tracker consume 5 0.5    # Use 0.5 units
npx pantry-tracker restock 5 2      # Add 2 units

# Alerts and shopping
npx pantry-tracker alerts           # Low stock alerts
npx pantry-tracker expiring 7       # Items expiring in 7 days
npx pantry-tracker shopping-list    # Generate shopping list

# Management
npx pantry-tracker stats            # Pantry statistics
npx pantry-tracker clear-expired    # Remove expired items
```

### Library Usage

```typescript
import { PantryTrackerSkill } from '@openclaw/pantry-tracker';

const pantry = new PantryTrackerSkill();

// Add items
const milk = await pantry.addItem({
  barcode: '0123456789',
  name: 'Organic Milk',
  quantity: 2,
  unit: 'gallon',
  category: 'dairy',
  expirationDate: '2026-02-15',
  lowStockThreshold: 1
});

// Get alerts
const lowStock = await pantry.getLowStockAlerts();
const expiring = await pantry.getExpirationAlerts(7);

// Generate shopping list
const shoppingList = await pantry.generateShoppingList();

// Clean up
await pantry.close();
```

## Categories

- **produce** - Fresh fruits and vegetables
- **meat** - Meat products
- **seafood** - Fish and seafood
- **dairy** - Milk, cheese, eggs
- **bakery** - Bread, pastries
- **frozen** - Frozen foods
- **pantry** - Dry goods, canned items
- **beverages** - Drinks
- **household** - Cleaning supplies, paper goods
- **other** - Miscellaneous

## Data Storage

All data is stored locally in SQLite at `~/.openclaw/skills/pantry-tracker/pantry.db`.

## No External Dependencies

This skill works entirely offline with no API keys or external services required.
