---
title: Reservation Manager
skill_id: reservation-manager
description: Restaurant table reservation system with calendar integration
version: 1.0.0
author: OpenClaw
dependencies:
  - calendar
---

# Reservation Manager

Restaurant table reservation system with table management, availability checking, and calendar integration.

## Features

- **Table Management**: Configure tables with capacity and sections
- **Availability Checking**: Find available time slots for party size
- **Reservation Management**: Create, update, cancel reservations
- **Calendar Integration**: Sync reservations to Google Calendar
- **SMS Notifications**: Confirmation and reminder messages
- **Multi-table Support**: Handle large parties across multiple tables

## Installation

```bash
cd skills/reservation-manager
npm install
npm run build
```

## Configuration

Set up restaurant configuration:

```typescript
const manager = new ReservationManager();

// Configure restaurant settings
await manager.updateConfig({
  name: 'My Bistro',
  openingTime: '11:00',
  closingTime: '22:00',
  timeSlotInterval: 30,
  defaultReservationDuration: 90,
  bufferBetweenReservations: 15,
  enableSmsConfirmations: true,
});
```

## Usage

### Table Management

```typescript
// Add tables
const table1 = await manager.addTable({
  number: 1,
  name: 'Table 1',
  capacity: 4,
  section: 'main',
});

const table2 = await manager.addTable({
  number: 2,
  name: 'Table 2',
  capacity: 6,
  section: 'patio',
});

// List tables
const tables = await manager.listTables({ activeOnly: true });
```

### Check Availability

```typescript
// Check availability for a date
const availability = await manager.checkAvailability('2026-02-15', 4);

// Show available slots
for (const slot of availability.slots) {
  if (slot.available) {
    console.log(`${slot.time}: ${slot.availableTables.length} tables available`);
  }
}
```

### Create Reservations

```typescript
// Book a reservation
const reservation = await manager.createReservation({
  guestName: 'John Doe',
  guestPhone: '+1234567890',
  guestEmail: 'john@example.com',
  partySize: 4,
  date: '2026-02-15',
  time: '19:00',
  duration: 120,
  specialRequests: 'Window seat preferred',
  occasion: 'anniversary',
  source: 'phone',
});
```

### Manage Reservations

```typescript
// List reservations
const today = new Date().toISOString().split('T')[0];
const reservations = await manager.listReservations({
  date: today,
  status: 'confirmed',
});

// Update reservation
await manager.updateReservation(reservation.id, {
  partySize: 6,
  specialRequests: 'Window seat, gluten-free menu',
});

// Mark as seated
await manager.updateReservation(reservation.id, { status: 'seated' });

// Complete reservation
await manager.updateReservation(reservation.id, { status: 'completed' });

// Cancel reservation
await manager.cancelReservation(reservation.id);
```

### SMS Notifications

```typescript
// Send reminders for today's reservations
const result = await manager.sendRemindersForToday();
console.log(`Sent ${result.sent} reminders`);
```

## CLI Usage

```bash
# Check status
npx ts-node src/cli.ts status

# Add tables
npx ts-node src/cli.ts table-add --name "Table 1" --number 1 --capacity 4
npx ts-node src/cli.ts table-add --name "Table 2" --number 2 --capacity 6 --section patio

# List tables
npx ts-node src/cli.ts tables

# Check availability
npx ts-node src/cli.ts available 2026-02-15 --party 4

# Create reservation
npx ts-node src/cli.ts book \
  --name "John Doe" \
  --phone "+1234567890" \
  --date 2026-02-15 \
  --time 19:00 \
  --party 4 \
  --requests "Window seat"

# List reservations
npx ts-node src/cli.ts reservations --date 2026-02-15

# Mark as seated/complete
npx ts-node src/cli.ts seat <reservation-id>
npx ts-node src/cli.ts complete <reservation-id>

# Cancel reservation
npx ts-node src/cli.ts cancel <reservation-id>

# Send reminders
npx ts-node src/cli.ts reminders

# View stats
npx ts-node src/cli.ts stats

# Configuration
npx ts-node src/cli.ts config
npx ts-node src/cli.ts config-set --key name --value "My Bistro"
```

## API Reference

### ReservationManager

Main class for managing reservations.

#### Constructor

```typescript
new ReservationManager(config?: {
  profile?: string;
  dataDir?: string;
})
```

#### Methods

**Table Management**
- `addTable(table)` - Add a new table
- `getTable(id)` - Get table by ID
- `listTables(options?)` - List all tables
- `updateTable(id, updates)` - Update a table
- `deleteTable(id)` - Delete a table

**Reservations**
- `createReservation(reservation)` - Create a new reservation
- `getReservation(id)` - Get reservation by ID
- `listReservations(filter?)` - List reservations with filters
- `updateReservation(id, updates)` - Update a reservation
- `cancelReservation(id, notify?)` - Cancel a reservation
- `deleteReservation(id)` - Delete a reservation

**Availability**
- `checkAvailability(date, partySize?)` - Check availability for a date
- `findAvailableTables(date, time, duration, partySize)` - Find available tables

**Configuration**
- `getConfig()` - Get restaurant configuration
- `updateConfig(updates)` - Update configuration

**SMS Notifications**
- `sendSmsConfirmation(reservation)` - Send confirmation SMS
- `sendSmsReminder(reservation)` - Send reminder SMS
- `sendRemindersForToday()` - Send reminders for today's reservations

**Stats & Health**
- `getStats(options?)` - Get reservation statistics
- `healthCheck()` - Check system health

## Data Model

### Table

```typescript
interface Table {
  id: string;
  number: number;
  name: string;
  capacity: number;
  section: string;
  isActive: boolean;
  notes?: string;
}
```

### Reservation

```typescript
interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  partySize: number;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  duration: number;    // minutes
  tableId?: string;
  tableIds?: string[]; // for large parties
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  specialRequests?: string;
  occasion?: string;
  source: 'phone' | 'walk_in' | 'online' | 'third_party';
  calendarEventId?: string;
  smsConfirmationSent: boolean;
  smsReminderSent: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Dependencies

- `@openclaw/calendar` - Calendar integration for event sync
- `sqlite3` - Local database storage

## License

MIT
