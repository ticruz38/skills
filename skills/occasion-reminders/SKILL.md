# Occasion Reminders Skill

Track birthdays and anniversaries with gift planning timeline.

## Usage

```typescript
import { OccasionRemindersSkill } from '@openclaw/occasion-reminders';

const skill = new OccasionRemindersSkill();

// Add a contact
const contact = await skill.addContact({
  name: 'Sarah Johnson',
  email: 'sarah@example.com',
  relationship: 'friend',
  notes: 'Likes hiking and photography'
});

// Add a birthday with advance notice
const birthday = await skill.addOccasion({
  contactId: contact.id,
  type: 'birthday',
  name: "Sarah's Birthday",
  month: 3,
  day: 15,
  year: 1990, // Optional - for age calculation
  advanceNotice: { weeks: 2, days: 0 },
  budget: 100,
  giftIdeas: 'Hiking gear, camera accessories, book'
});

// Get upcoming occasions
const upcoming = await skill.getUpcomingOccasions(30);
for (const occasion of upcoming) {
  console.log(`${occasion.name} in ${occasion.daysUntil} days`);
  if (occasion.isAdvanceNotice) {
    console.log('🎁 Time to start gift planning!');
  }
}

// Get gift planning timeline
const timeline = await skill.getGiftPlanningTimeline(60);
for (const item of timeline) {
  console.log(`Start shopping for ${item.occasion.name} by ${item.timeline.startShopping}`);
}
```

## CLI Usage

```bash
# Add contacts
occasion-reminders add-contact "Sarah Johnson" --email sarah@example.com --relationship "friend"
occasion-reminders add-contact "Mom" --relationship "family" --notes "Likes gardening"

# Add occasions
occasion-reminders add-occasion 1 birthday "Sarah's Birthday" 3 15 --year 1990 --budget 100
occasion-reminders add-occasion 2 anniversary "Parents Anniversary" 6 12 --year 1985 --advance-weeks 3

# View upcoming occasions
occasion-reminders upcoming 30
occasion-reminders birthdays
occasion-reminders anniversaries

# Gift planning timeline
occasion-reminders timeline 90

# Manage contacts and occasions
occasion-reminders list-contacts
occasion-reminders list-occasions
occasion-reminders get-contact 1
occasion-reminders delete-occasion 3

# Import contacts
occasion-reminders import contacts.json --format json
occasion-reminders import contacts.csv --format csv

# Search
occasion-reminders search "birthday"
occasion-reminders search "mom"

# Statistics
occasion-reminders stats
occasion-reminders health
```

## Features

### Contact Management
- Store contact information (name, email, phone)
- Track relationships (family, friend, colleague, etc.)
- Add personal notes
- Import from CSV or JSON

### Occasion Tracking
- Birthday tracking with age calculation
- Anniversary tracking with years together
- Custom occasion types (holidays, graduations, etc.)
- Recurring annual reminders

### Advance Notice
- Configurable advance notice (weeks + days)
- Gift planning timeline
- Start shopping reminders
- Order-by and wrap-by dates

### Gift Planning
- Budget tracking per occasion
- Gift ideas storage
- Shopping timeline with suggested actions
- Integration with gift-suggestions skill

## Database Schema

### contacts
- `id` - Primary key
- `name` - Contact name
- `email` - Optional email
- `phone` - Optional phone
- `notes` - Free-form notes
- `relationship` - Relationship type
- `created_at` - Timestamp

### occasions
- `id` - Primary key
- `contact_id` - Reference to contact
- `type` - birthday, anniversary, holiday, custom
- `name` - Occasion name
- `month` - Month (1-12)
- `day` - Day (1-31)
- `year` - Optional year (for age/years calculation)
- `advance_weeks` - Weeks of advance notice
- `advance_days` - Days of advance notice
- `gift_ideas` - Gift ideas/description
- `budget` - Gift budget
- `reminder_id` - Reference to reminders skill
- `created_at` - Timestamp

## Occasion Types

- **birthday** - Annual birthday with optional age calculation
- **anniversary** - Annual anniversary with optional years-together
- **holiday** - Fixed-date holidays (Christmas, Valentine's Day, etc.)
- **custom** - Any custom recurring occasion

## Integration with Reminders Skill

This skill depends on the reminders skill to create advance notice reminders. When you add an occasion, it automatically creates a reminder in the reminders skill that will trigger at the configured advance notice time.

## Import Formats

### JSON
```json
[
  {
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "555-1234",
    "relationship": "friend",
    "notes": "Likes hiking"
  }
]
```

### CSV
```csv
name,email,phone,relationship,notes
Sarah Johnson,sarah@example.com,555-1234,friend,Likes hiking
```
