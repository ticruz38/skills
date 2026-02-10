---
title: Expense Categorizer
skill_id: expense-categorizer
description: Auto-categorize expenses from receipts with learning from corrections
author: OpenClaw
version: 1.0.0
dependencies:
  - receipts-ocr
---

# Expense Categorizer Skill

Auto-categorize expenses from receipts using ML/rule-based categorization with learning from user corrections.

## Features

- **Smart Categorization**: Rule-based and ML-inspired categorization using merchant names, keywords, and receipt content
- **Custom Categories**: Define your own expense categories beyond the defaults
- **Learning System**: Improves accuracy by learning from user corrections
- **Bulk Categorization**: Process multiple receipts at once
- **Confidence Scoring**: Each categorization includes a confidence score
- **Merchant Mapping**: Automatic merchant-to-category mapping based on history

## Installation

```bash
cd skills/expense-categorizer
npm install
npm run build
```

## Usage

### CLI

```bash
# Check status
npm run cli -- status

# Categorize a single receipt
npm run cli -- categorize 1

# Categorize all uncategorized receipts
npm run cli -- bulk

# Suggest category for a receipt (dry run)
npm run cli -- suggest 1

# Apply a correction (teaches the system)
npm run cli -- correct 1 --category "Office Supplies"

# Manage categories
npm run cli -- categories
npm run cli -- add-category "Professional Development" --keywords "course,training,certification,conference"

# View merchant mappings
npm run cli -- merchants
npm run cli -- map-merchant "Starbucks" --category "Dining"

# Statistics
npm run cli -- stats
npm run cli -- accuracy
```

### Library

```typescript
import { ExpenseCategorizerSkill } from '@openclaw/expense-categorizer';

const skill = new ExpenseCategorizerSkill();

// Categorize a single receipt
const result = await skill.categorizeReceipt(1);
console.log(result.category);  // "Dining"
console.log(result.confidence);  // 0.92

// Bulk categorize all uncategorized receipts
const results = await skill.bulkCategorize();

// Suggest category without applying
const suggestion = await skill.suggestCategory(1);

// Apply correction to teach the system
await skill.applyCorrection(1, 'Office Supplies');

// Manage custom categories
await skill.addCategory({
  name: 'Professional Development',
  keywords: ['course', 'training', 'certification'],
  parentCategory: 'Business'
});

// Get merchant mappings
const mappings = await skill.getMerchantMappings();

// Manually map a merchant
await skill.mapMerchant('Starbucks', 'Dining');

// Get categorization statistics
const stats = await skill.getStats();

await skill.close();
```

## Default Categories

- **Groceries**: Supermarkets, food stores
- **Dining**: Restaurants, cafes, fast food
- **Gas**: Fuel stations, car services
- **Pharmacy**: Drugstores, medical supplies
- **Office**: Office supplies, stationery
- **Electronics**: Tech stores, gadgets
- **Transportation**: Rideshare, transit, parking
- **Entertainment**: Movies, games, events
- **Retail**: General shopping
- **Utilities**: Electricity, gas, water, internet
- **Travel**: Hotels, flights, car rentals
- **Healthcare**: Medical, dental, vision

## How It Works

1. **Rule-Based Matching**: First checks merchant name against known mappings
2. **Keyword Analysis**: Analyzes receipt content for category keywords
3. **Line Item Analysis**: Considers purchased items for categorization
4. **Learning**: When you correct a category, the system learns for future receipts

## Data Storage

Data is stored in `~/.openclaw/skills/expense-categorizer/`:
- `categorizer.db` - SQLite database with categories, mappings, and learning data

## Confidence Levels

- **High (80-100%)**: Strong merchant match or multiple keyword matches
- **Medium (50-79%)**: Partial keyword matches or similar merchant
- **Low (<50%)**: No clear match - manual review recommended
