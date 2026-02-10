---
title: Shopping List Generator
description: Generate organized shopping lists from meal plans with pantry checking
author: OpenClaw
tags: [shopping, groceries, meal-planning, pantry, lists]
---

# Shopping List Generator

Generate organized shopping lists from recipes and meal plans. Automatically categorizes items by store section, checks against pantry inventory, and merges duplicates for efficient shopping.

## Installation

```bash
cd skills/shopping-list-generator
npm install
npm run build
```

## Usage

### CLI

```bash
# Generate list from recipes
npm run cli -- generate ita-001 mex-002 --name "Weekly Shop"

# Create empty list
npm run cli -- create "Dinner Party"

# List all lists
npm run cli -- list

# View list details
npm run cli -- get 1

# Add item to list
npm run cli -- add 1 "Milk" --amount "1 gallon" --section dairy

# Toggle item checked status
npm run cli -- toggle 5

# Show by sections
npm run cli -- sections 1

# Export to text
npm run cli -- export 1

# Pantry management
npm run cli -- pantry-add "Olive Oil" --section pantry --expires 2025-12-31
npm run cli -- pantry-list
npm run cli -- pantry-search "oil"
```

### Library

```typescript
import { ShoppingListGeneratorSkill } from '@openclaw/shopping-list-generator';

const skill = new ShoppingListGeneratorSkill();

// Generate from recipes
const list = await skill.generateFromRecipeIds(
  ['ita-001', 'mex-002'],
  'Weekly Shop',
  { pantryCheck: true, mergeDuplicates: true }
);

// Create empty list
const list = await skill.createList('My List', [
  { name: 'Milk', amount: '1 gallon', section: 'dairy', checked: false }
]);

// Add to pantry
await skill.addToPantry({
  name: 'Olive Oil',
  amount: '16 oz',
  section: 'pantry',
  expiresAt: '2025-12-31'
});

// Check if ingredient is in pantry
const hasIt = await skill.hasInPantry('olive oil');

await skill.close();
```

## Features

- **Recipe Integration**: Generate lists directly from recipe IDs
- **Smart Categorization**: Automatically sorts items into store sections (produce, meat, dairy, etc.)
- **Pantry Check**: Skip items you already have in stock
- **Duplicate Merging**: Combines duplicate ingredients from multiple recipes
- **Scaling**: Adjust quantities for different serving sizes
- **Pantry Management**: Track inventory with expiration dates
- **Store Section Organization**: Items grouped by typical store layout

## Store Sections

- **Produce**: Fruits, vegetables, herbs
- **Meat**: Beef, chicken, pork, etc.
- **Seafood**: Fish, shellfish
- **Dairy**: Milk, cheese, eggs, yogurt
- **Bakery**: Bread, buns, pastries
- **Frozen**: Frozen foods, ice cream
- **Pantry**: Dry goods, canned items, spices
- **Beverages**: Drinks, alcohol
- **Household**: Cleaning supplies, paper goods
- **Other**: Uncategorized items

## Configuration

No external API keys required. Data is stored locally in SQLite at `~/.openclaw/skills/shopping-list-generator/shopping.db`.
