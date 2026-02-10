---
title: Recipe Suggester
skill_id: recipe-suggester
description: Suggest recipes based on dietary preferences, available ingredients, and cuisine preferences
author: OpenClaw
---

# Recipe Suggester

Suggest recipes based on dietary preferences, available ingredients, cuisine preferences, and difficulty levels.

## Features

- **Dietary Filters**: Filter by vegetarian, vegan, gluten-free, keto, paleo, dairy-free, nut-free, low-carb
- **Ingredient Matching**: Find recipes using ingredients you have on hand
- **Cuisine Preferences**: Italian, Mexican, Asian, Mediterranean, American, Indian, French, Thai, Japanese, Mediterranean
- **Difficulty Levels**: Easy (beginner), Medium (some experience), Hard (advanced techniques)
- **Meal Type**: Breakfast, lunch, dinner, snack, dessert, appetizer
- **Cooking Time**: Quick (<30 min), medium (30-60 min), long (>60 min)
- **Recipe Database**: 100+ curated recipes with full details

## Usage

### CLI

```bash
# Search recipes with filters
npm run cli -- suggest --dietary vegetarian --cuisine italian --difficulty easy

# Search by ingredients you have
npm run cli -- by-ingredients "chicken,rice,onion"

# List all available filters
npm run cli -- diets
npm run cli -- cuisines

# View recipe details
npm run cli -- get <recipe-id>

# Quick random suggestion
npm run cli -- random

# View statistics
npm run cli -- stats
```

### Library

```typescript
import { RecipeSuggesterSkill } from '@openclaw/recipe-suggester';

const skill = new RecipeSuggesterSkill();

// Suggest recipes with filters
const suggestions = await skill.suggestRecipes({
  dietary: ['vegetarian', 'gluten-free'],
  cuisine: 'italian',
  difficulty: 'easy',
  maxTime: 30,
  mealType: 'dinner',
  count: 5
});

// Find recipes by ingredients
const byIngredients = await skill.findByIngredients(
  ['chicken', 'rice', 'onion'],
  { matchThreshold: 0.7 }
);

// Get random suggestion
const random = await skill.getRandomRecipe({ dietary: ['vegan'] });

await skill.close();
```

## Storage

- SQLite database in `~/.openclaw/skills/recipe-suggester/`
- Tracks recipe history and favorites
- Stores user preferences for better suggestions
