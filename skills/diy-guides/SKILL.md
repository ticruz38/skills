---
title: DIY Guides
skill_id: diy_guides
version: 1.0.0
description: Step-by-step DIY repair guides with video links, tools lists, and difficulty ratings
status: stable
---

# DIY Guides

Step-by-step repair guides for common home maintenance tasks. Includes video links, tools lists, materials needed, difficulty ratings, and safety warnings.

## Overview

The DIY Guides skill provides a curated database of home repair guides covering plumbing, electrical, appliances, furniture, outdoor work, automotive, painting, flooring, HVAC, and general repairs.

## Features

- **12 Pre-loaded Guides**: Common repairs from fixing leaky faucets to changing tires
- **Difficulty Ratings**: Easy, Medium, and Hard classifications
- **Tool & Material Lists**: Complete lists of what you'll need
- **Video Links**: Curated video tutorials for visual learners
- **Step-by-Step Instructions**: Numbered steps with detailed descriptions
- **Pro Tips**: Expert advice for better results
- **Safety Warnings**: Important precautions for each repair
- **Cost Estimates**: Approximate cost for materials
- **Time Estimates**: Expected duration for completion

## Categories

| Category | Icon | Description |
|----------|------|-------------|
| plumbing | 🔧 | Faucets, drains, toilets, pipes |
| electrical | ⚡ | Switches, outlets, wiring |
| appliance | 🔌 | Major appliances repair |
| furniture | 🪑 | Assembly, repair, refinishing |
| outdoor | 🌳 | Landscaping, gutters, exterior |
| automotive | 🚗 | Car maintenance and repair |
| painting | 🎨 | Interior/exterior painting |
| flooring | 🏠 | Floor installation, repair |
| hvac | ❄️ | Heating, cooling, ventilation |
| general | 🔨 | Miscellaneous repairs |

## Installation

```bash
cd skills/diy-guides
npm install
npm run build
```

## CLI Usage

### List all guides
```bash
npm run cli -- list
```

### View a guide
```bash
npm run cli -- get 1
```

### Search guides
```bash
npm run cli -- search "faucet"
```

### Filter by category
```bash
npm run cli -- category plumbing
```

### Filter by difficulty
```bash
npm run cli -- difficulty easy
```

### View tools needed
```bash
npm run cli -- tools 1
```

### View materials needed
```bash
npm run cli -- materials 1
```

### View step-by-step instructions
```bash
npm run cli -- steps 1
```

### View safety warnings
```bash
npm run cli -- warnings 1
```

## Programmatic Usage

```typescript
import { DIYGuidesSkill } from '@openclaw/diy-guides';

const skill = new DIYGuidesSkill();

// Initialize and seed default guides
await skill.initialize();

// Get all guides
const guides = await skill.listGuides();

// Get specific guide
const guide = await skill.getGuide(1);

// Search guides
const results = await skill.searchGuides({ 
  category: 'plumbing',
  difficulty: 'easy',
  searchTerm: 'faucet'
});

// Get guides by category
const plumbingGuides = await skill.getGuidesByCategory('plumbing');

// Get guides by difficulty
const easyGuides = await skill.getGuidesByDifficulty('easy');

// Get statistics
const stats = await skill.getStats();

await skill.close();
```

## Guide Structure

```typescript
interface DIYGuide {
  id?: number;
  title: string;
  description: string;
  category: RepairCategory;
  difficulty: DifficultyLevel;
  estimatedTime: string;
  tools: string[];
  materials: string[];
  steps: GuideStep[];
  videoLinks?: VideoLink[];
  tips?: string[];
  warnings?: string[];
  skillLevel?: string;
  costEstimate?: string;
}

interface GuideStep {
  stepNumber: number;
  title: string;
  description: string;
  imageUrl?: string;
}

interface VideoLink {
  title: string;
  url: string;
  platform: 'youtube' | 'vimeo' | 'other';
  duration?: string;
}
```

## Default Guides

The skill includes 12 pre-loaded repair guides:

1. **Fix a Leaky Faucet** (Plumbing, Easy)
2. **Unclog a Drain** (Plumbing, Easy)
3. **Replace a Light Switch** (Electrical, Medium)
4. **Patch Drywall Holes** (General, Medium)
5. **Fix a Running Toilet** (Plumbing, Easy)
6. **Replace Cabinet Hardware** (Furniture, Easy)
7. **Caulk a Bathtub or Shower** (Plumbing, Medium)
8. **Replace an HVAC Filter** (HVAC, Easy)
9. **Fix Squeaky Floors** (Flooring, Medium)
10. **Change a Tire** (Automotive, Medium)
11. **Paint a Room** (Painting, Medium)
12. **Clean Gutters** (Outdoor, Medium)

## Database Schema

The skill uses SQLite with the following schema:

```sql
CREATE TABLE guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  estimated_time TEXT NOT NULL,
  tools TEXT NOT NULL,          -- JSON array
  materials TEXT NOT NULL,      -- JSON array
  steps TEXT NOT NULL,          -- JSON array
  video_links TEXT,             -- JSON array (optional)
  tips TEXT,                    -- JSON array (optional)
  warnings TEXT,                -- JSON array (optional)
  skill_level TEXT,             -- optional
  cost_estimate TEXT,           -- optional
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Dependencies

- `sqlite3`: Database storage

## Type Safety

All difficulty levels and categories are typed:

```typescript
type DifficultyLevel = 'easy' | 'medium' | 'hard';

type RepairCategory = 
  | 'plumbing' 
  | 'electrical' 
  | 'appliance' 
  | 'furniture' 
  | 'outdoor' 
  | 'automotive' 
  | 'painting' 
  | 'flooring' 
  | 'hvac' 
  | 'general';
```

## Error Handling

The skill throws errors for:
- Database initialization failures
- Guide not found (returns null)
- Invalid search parameters

Always wrap calls in try-catch blocks and close the skill in a finally block.

## Health Check

```typescript
const health = await skill.healthCheck();
// { healthy: true, message: "DIY Guides skill healthy. 12 guides available." }
```

## No External Dependencies

This skill works entirely offline with local SQLite storage. No API keys or internet connection required.
