---
title: Itinerary Builder
description: Build day-by-day travel itineraries with drag-drop scheduling, time estimates, and PDF export
---

# Itinerary Builder

Build detailed day-by-day travel itineraries with activity scheduling, time estimates between locations, and export to PDF.

## Features

- **Trip Management**: Create and manage trips with destination, dates, and descriptions
- **Day-by-Day Scheduling**: Organize activities by day with start/end times
- **Activity Categories**: Transport, sightseeing, food, shopping, entertainment, relaxation, accommodation, other
- **Drag-Drop Reordering**: Reorder activities within a day via CLI
- **Travel Time Estimation**: Automatic travel time estimates between activities
- **Cost Tracking**: Track estimated costs per activity with currency support
- **Export to PDF**: Generate professional HTML itineraries ready for PDF conversion
- **Booking References**: Store booking confirmations and references

## Installation

```bash
cd skills/itinerary-builder
npm install
npm run build
```

## Usage

### CLI

```bash
# Create a new trip
npm run cli -- create-trip "Japan Adventure" "Tokyo, Japan" 2024-04-01 2024-04-10

# List all trips
npm run cli -- list-trips

# Get trip details
npm run cli -- get-trip 1

# Add activities
npm run cli -- add-activity 1 1 "Visit Senso-ji Temple" \
  --start 09:00 --duration 120 --category sightseeing --location "Asakusa"

npm run cli -- add-activity 1 1 "Lunch at Sushi Dai" \
  --start 12:00 --duration 90 --category food --location "Tsukiji"

# View day-by-day schedule
npm run cli -- schedule 1

# Reorder activities
npm run cli -- reorder 1 1 3 1 2

# Move activity to different day
npm run cli -- move 5 2

# Export to HTML (PDF-ready)
npm run cli -- export 1 ./my-trip.html

# Show statistics
npm run cli -- stats
```

### Library

```typescript
import { ItineraryBuilder } from '@openclaw/itinerary-builder';

const builder = new ItineraryBuilder();

// Create a trip
const trip = await builder.createTrip({
  name: 'Japan Adventure',
  destination: 'Tokyo, Japan',
  startDate: '2024-04-01',
  endDate: '2024-04-10',
  description: 'Cherry blossom season trip'
});

// Add activities
const activity = await builder.addActivity({
  tripId: trip.id!,
  dayNumber: 1,
  title: 'Visit Senso-ji Temple',
  startTime: '09:00',
  duration: 120,
  category: 'sightseeing',
  location: 'Asakusa, Tokyo'
});

// Get full itinerary
const itinerary = await builder.exportItinerary(trip.id!);
console.log(`Total activities: ${itinerary.summary.totalActivities}`);
console.log(`Estimated cost: $${itinerary.summary.estimatedCost}`);

// Generate day schedule
const schedule = await builder.generateSchedule(trip.id!);
for (const day of schedule) {
  console.log(`Day ${day.dayNumber}:`);
  for (const activity of day.activities) {
    console.log(`  ${activity.startTime} - ${activity.title}`);
  }
}

// Export to HTML
const htmlPath = await builder.exportToHTML(trip.id!, './my-itinerary.html');

await builder.close();
```

## Data Models

### Trip

```typescript
interface Trip {
  id?: number;
  name: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Activity

```typescript
interface Activity {
  id?: number;
  tripId: number;
  dayNumber: number;
  title: string;
  description?: string;
  startTime?: string;    // HH:MM format
  endTime?: string;      // HH:MM format
  duration?: number;     // minutes
  location?: string;
  address?: string;
  category: 'transport' | 'sightseeing' | 'food' | 'shopping' | 
            'entertainment' | 'relaxation' | 'accommodation' | 'other';
  cost?: number;
  currency?: string;
  notes?: string;
  bookingRef?: string;
  orderIndex: number;
}
```

## CLI Reference

### Trip Commands

| Command | Description |
|---------|-------------|
| `create-trip <name> <dest> <start> <end>` | Create new trip |
| `list-trips` | List all trips |
| `get-trip <id>` | View trip details |
| `update-trip <id> [--name <n>] [--destination <d>] ...` | Update trip |
| `delete-trip <id>` | Delete trip |

### Activity Commands

| Command | Description |
|---------|-------------|
| `add-activity <tripId> <day> <title> [options]` | Add activity |
| `list-activities <tripId>` | List activities for trip |
| `get-activity <id>` | View activity details |
| `update-activity <id> [options]` | Update activity |
| `delete-activity <id>` | Delete activity |
| `reorder <tripId> <day> <id1> <id2> ...` | Reorder activities |
| `move <activityId> <newDay> [--order <n>]` | Move to different day |

### Other Commands

| Command | Description |
|---------|-------------|
| `schedule <tripId>` | Show day-by-day schedule |
| `export <tripId> [path]` | Export to HTML |
| `stats` | Show statistics |
| `health` | Check system health |

## HTML Export

Itineraries are exported as professionally styled HTML files ready for PDF conversion:

```typescript
const html = builder.generateHTML(itinerary);
const filePath = await builder.exportToHTML(tripId, './itinerary.html');
```

HTML features:
- Professional styling with CSS
- Day-by-day layout
- Activity times and locations
- Cost summaries
- Print-friendly formatting
- Responsive design

Convert to PDF using browser print or tools like `puppeteer`.

## Storage

Data is stored in SQLite at `~/.openclaw/skills/itinerary-builder/itineraries.db`:

- **trips** - Trip metadata
- **activities** - Activity details with ordering

## Dependencies

- `sqlite3` - Database storage
- No external API dependencies - works entirely offline
