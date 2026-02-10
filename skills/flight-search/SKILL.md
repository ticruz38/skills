---
title: Flight Search
description: Search and compare flights for travel planning
---

# Flight Search Skill

Search for flights, compare prices, and manage saved searches.

## Installation

```bash
cd skills/flight-search
npm install
npm run build
```

## Usage

### Search Flights

```bash
# Basic search
npm run cli -- search JFK LAX 2024-03-15

# Round trip
npm run cli -- search JFK LAX 2024-03-15 --return-date 2024-03-22

# Business class with max 1 stop
npm run cli -- search JFK LHR 2024-03-15 --cabin business --max-stops 1

# Search with flexible dates (+/- 3 days)
npm run cli -- search JFK LAX 2024-03-15 --flexible

# Filter by specific airlines
npm run cli -- search JFK LAX 2024-03-15 --airlines AA,DL,UA

# Sort by duration instead of price
npm run cli -- search JFK LAX 2024-03-15 --sort-by duration
```

### Browse Airports and Airlines

```bash
# List all airports
npm run cli -- airports

# Search airports
npm run cli -- airports "New York"

# List airlines
npm run cli -- airlines
```

### Save and Manage Searches

```bash
# Save a search configuration
npm run cli -- save "NYC to LA" JFK LAX --cabin business --max-stops 0

# List saved searches
npm run cli -- saved

# Delete a saved search
npm run cli -- delete-saved 1
```

### Check Status

```bash
npm run cli -- health
```

## Environment Variables

- `AMADEUS_API_KEY` - Optional. Set to use Amadeus API for real flight data.

## API

```typescript
import FlightSearchSkill from '@openclaw/flight-search';

const skill = new FlightSearchSkill();

// Search flights
const results = await skill.searchFlights('JFK', 'LAX', {
  departureDate: '2024-03-15',
  returnDate: '2024-03-22',
  passengers: 2,
  cabin: 'business',
  maxStops: 1,
  flexibleDates: true
});

// Save a search
const saved = await skill.saveSearch({
  name: 'Weekly NYC-LA',
  origin: 'JFK',
  destination: 'LAX',
  passengers: 1,
  cabin: 'economy'
});

// Get airports
const airports = await skill.getAirports('New York');
```

## Features

- Route search between airports
- Price comparison
- Date flexibility (±3 days)
- Filter by airline/stops
- Cabin class selection
- Saved searches
- Results caching
- Round-trip support
