#!/usr/bin/env node
import { ItineraryBuilder, Activity, Trip } from './index';

const args = process.argv.slice(2);
const command = args[0];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(time?: string): string {
  if (!time) return 'TBD';
  return time;
}

function showHelp(): void {
  console.log(`
Itinerary Builder CLI

Commands:
  create-trip <name> <destination> <startDate> <endDate> [description]
    Create a new trip
    Example: create-trip "Japan Adventure" "Tokyo, Japan" 2024-04-01 2024-04-10 "Cherry blossom season"

  list-trips
    List all trips

  get-trip <id>
    Get trip details with activities

  update-trip <id> [--name <name>] [--destination <dest>] [--start <date>] [--end <date>] [--description <desc>]
    Update trip details

  delete-trip <id>
    Delete a trip and all its activities

  add-activity <tripId> <dayNumber> <title> [options]
    Add activity to trip
    Options:
      --description <text>    Activity description
      --start <HH:MM>         Start time
      --end <HH:MM>           End time
      --duration <minutes>    Duration in minutes
      --location <name>       Location name
      --address <address>     Full address
      --category <type>       Category: transport, sightseeing, food, shopping, entertainment, relaxation, accommodation, other
      --cost <amount>         Cost amount
      --currency <code>       Currency code (default: USD)
      --notes <text>          Additional notes
      --booking <ref>         Booking reference
      --order <index>         Order within day (default: 0)
    Example: add-activity 1 1 "Visit Senso-ji Temple" --start 09:00 --duration 120 --category sightseeing

  list-activities <tripId>
    List all activities for a trip

  get-activity <id>
    Get activity details

  update-activity <id> [options]
    Update activity (same options as add-activity, plus --day <number>)

  delete-activity <id>
    Delete an activity

  reorder <tripId> <dayNumber> <activityId1> <activityId2> ...
    Reorder activities within a day
    Example: reorder 1 1 5 3 4 2

  move <activityId> <newDayNumber> [--order <index>]
    Move activity to different day

  schedule <tripId>
    Show day-by-day schedule

  export <tripId> [filePath]
    Export itinerary to HTML file
    Example: export 1 ./my-trip.html

  stats
    Show statistics

  health
    Check system health

  help
    Show this help message
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  return options;
}

async function main(): Promise<void> {
  const skill = new ItineraryBuilder();

  try {
    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      case 'create-trip': {
        const [name, destination, startDate, endDate, ...descParts] = args.slice(1);
        if (!name || !destination || !startDate || !endDate) {
          console.error('Error: Missing required arguments. Use: create-trip <name> <destination> <startDate> <endDate>');
          process.exit(1);
        }
        const trip = await skill.createTrip({
          name,
          destination,
          startDate,
          endDate,
          description: descParts.join(' ') || undefined
        });
        console.log('Trip created successfully!');
        console.log(`ID: ${trip.id}`);
        console.log(`Name: ${trip.name}`);
        console.log(`Destination: ${trip.destination}`);
        console.log(`Dates: ${trip.startDate} to ${trip.endDate}`);
        break;
      }

      case 'list-trips': {
        const trips = await skill.listTrips();
        if (trips.length === 0) {
          console.log('No trips found.');
          break;
        }
        console.log(`\nFound ${trips.length} trip(s):\n`);
        console.log('ID  | Destination              | Dates                    | Name');
        console.log('----|--------------------------|--------------------------|---------------------------');
        for (const trip of trips) {
          const dest = trip.destination.padEnd(24).substring(0, 24);
          const dates = `${trip.startDate} to ${trip.endDate}`.padEnd(24).substring(0, 24);
          console.log(`${String(trip.id).padEnd(3)} | ${dest} | ${dates} | ${trip.name}`);
        }
        break;
      }

      case 'get-trip': {
        const tripId = parseInt(args[1]);
        if (isNaN(tripId)) {
          console.error('Error: Invalid trip ID');
          process.exit(1);
        }
        const trip = await skill.getTripWithActivities(tripId);
        if (!trip) {
          console.error('Error: Trip not found');
          process.exit(1);
        }
        console.log(`\n📍 ${trip.name}`);
        console.log(`Destination: ${trip.destination}`);
        console.log(`Dates: ${formatDate(trip.startDate)} to ${formatDate(trip.endDate)}`);
        if (trip.description) console.log(`Description: ${trip.description}`);
        console.log(`\nActivities: ${trip.activities.length}`);
        if (trip.activities.length > 0) {
          const byDay = trip.activities.reduce((acc, act) => {
            acc[act.dayNumber] = (acc[act.dayNumber] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);
          Object.entries(byDay).forEach(([day, count]) => {
            console.log(`  Day ${day}: ${count} activity(s)`);
          });
        }
        break;
      }

      case 'update-trip': {
        const tripId = parseInt(args[1]);
        if (isNaN(tripId)) {
          console.error('Error: Invalid trip ID');
          process.exit(1);
        }
        const options = parseArgs(args.slice(2));
        const updates: Partial<Trip> = {};
        if (options.name) updates.name = options.name;
        if (options.destination) updates.destination = options.destination;
        if (options.start) updates.startDate = options.start;
        if (options.end) updates.endDate = options.end;
        if (options.description) updates.description = options.description;
        
        const trip = await skill.updateTrip(tripId, updates);
        if (!trip) {
          console.error('Error: Trip not found');
          process.exit(1);
        }
        console.log('Trip updated successfully!');
        console.log(`ID: ${trip.id}`);
        console.log(`Name: ${trip.name}`);
        console.log(`Destination: ${trip.destination}`);
        break;
      }

      case 'delete-trip': {
        const tripId = parseInt(args[1]);
        if (isNaN(tripId)) {
          console.error('Error: Invalid trip ID');
          process.exit(1);
        }
        const success = await skill.deleteTrip(tripId);
        if (success) {
          console.log('Trip deleted successfully!');
        } else {
          console.error('Error: Trip not found');
          process.exit(1);
        }
        break;
      }

      case 'add-activity': {
        const [tripIdStr, dayNumberStr, title, ...rest] = args.slice(1);
        const tripId = parseInt(tripIdStr);
        const dayNumber = parseInt(dayNumberStr);
        if (isNaN(tripId) || isNaN(dayNumber) || !title) {
          console.error('Error: Missing required arguments. Use: add-activity <tripId> <dayNumber> <title>');
          process.exit(1);
        }
        const options = parseArgs(rest);
        const activity = await skill.addActivity({
          tripId,
          dayNumber,
          title,
          description: options.description,
          startTime: options.start,
          endTime: options.end,
          duration: options.duration ? parseInt(options.duration) : undefined,
          location: options.location,
          address: options.address,
          category: (options.category as Activity['category']) || 'other',
          cost: options.cost ? parseFloat(options.cost) : undefined,
          currency: options.currency || 'USD',
          notes: options.notes,
          bookingRef: options.booking,
          orderIndex: options.order ? parseInt(options.order) : 0
        });
        console.log('Activity added successfully!');
        console.log(`ID: ${activity.id}`);
        console.log(`Title: ${activity.title}`);
        console.log(`Day: ${activity.dayNumber}`);
        break;
      }

      case 'list-activities': {
        const tripId = parseInt(args[1]);
        if (isNaN(tripId)) {
          console.error('Error: Invalid trip ID');
          process.exit(1);
        }
        const activities = await skill.getActivitiesByTrip(tripId);
        if (activities.length === 0) {
          console.log('No activities found for this trip.');
          break;
        }
        console.log(`\nFound ${activities.length} activity(s):\n`);
        const trip = await skill.getTrip(tripId);
        const startDate = trip ? new Date(trip.startDate) : new Date();
        
        let currentDay = 0;
        for (const activity of activities) {
          if (activity.dayNumber !== currentDay) {
            currentDay = activity.dayNumber;
            const date = new Date(startDate);
            date.setDate(date.getDate() + (currentDay - 1));
            console.log(`\n📅 Day ${currentDay} - ${date.toLocaleDateString()}:`);
            console.log('─'.repeat(60));
          }
          const time = activity.startTime ? `🕐 ${formatTime(activity.startTime)}` : '📌';
          const cost = activity.cost ? ` | $${activity.cost}` : '';
          console.log(`${time} ${activity.title} [${activity.category}]${cost}`);
          if (activity.location) console.log(`   📍 ${activity.location}`);
        }
        break;
      }

      case 'get-activity': {
        const activityId = parseInt(args[1]);
        if (isNaN(activityId)) {
          console.error('Error: Invalid activity ID');
          process.exit(1);
        }
        const activity = await skill.getActivity(activityId);
        if (!activity) {
          console.error('Error: Activity not found');
          process.exit(1);
        }
        console.log(`\n🎯 ${activity.title}`);
        console.log(`Day: ${activity.dayNumber}`);
        console.log(`Category: ${activity.category}`);
        if (activity.startTime) console.log(`Time: ${formatTime(activity.startTime)}${activity.endTime ? ` - ${formatTime(activity.endTime)}` : ''}`);
        if (activity.duration) console.log(`Duration: ${activity.duration} minutes`);
        if (activity.location) console.log(`Location: ${activity.location}`);
        if (activity.address) console.log(`Address: ${activity.address}`);
        if (activity.cost) console.log(`Cost: ${activity.cost} ${activity.currency}`);
        if (activity.description) console.log(`Description: ${activity.description}`);
        if (activity.notes) console.log(`Notes: ${activity.notes}`);
        if (activity.bookingRef) console.log(`Booking Ref: ${activity.bookingRef}`);
        break;
      }

      case 'update-activity': {
        const activityId = parseInt(args[1]);
        if (isNaN(activityId)) {
          console.error('Error: Invalid activity ID');
          process.exit(1);
        }
        const options = parseArgs(args.slice(2));
        const updates: Partial<Activity> = {};
        if (options.day) updates.dayNumber = parseInt(options.day);
        if (options.title) updates.title = options.title;
        if (options.description) updates.description = options.description;
        if (options.start) updates.startTime = options.start;
        if (options.end) updates.endTime = options.end;
        if (options.duration) updates.duration = parseInt(options.duration);
        if (options.location) updates.location = options.location;
        if (options.address) updates.address = options.address;
        if (options.category) updates.category = options.category as Activity['category'];
        if (options.cost) updates.cost = parseFloat(options.cost);
        if (options.currency) updates.currency = options.currency;
        if (options.notes) updates.notes = options.notes;
        if (options.booking) updates.bookingRef = options.booking;
        if (options.order) updates.orderIndex = parseInt(options.order);
        
        const activity = await skill.updateActivity(activityId, updates);
        if (!activity) {
          console.error('Error: Activity not found');
          process.exit(1);
        }
        console.log('Activity updated successfully!');
        console.log(`ID: ${activity.id}`);
        console.log(`Title: ${activity.title}`);
        break;
      }

      case 'delete-activity': {
        const activityId = parseInt(args[1]);
        if (isNaN(activityId)) {
          console.error('Error: Invalid activity ID');
          process.exit(1);
        }
        const success = await skill.deleteActivity(activityId);
        if (success) {
          console.log('Activity deleted successfully!');
        } else {
          console.error('Error: Activity not found');
          process.exit(1);
        }
        break;
      }

      case 'reorder': {
        const tripId = parseInt(args[1]);
        const dayNumber = parseInt(args[2]);
        const activityIds = args.slice(3).map(id => parseInt(id)).filter(id => !isNaN(id));
        if (isNaN(tripId) || isNaN(dayNumber) || activityIds.length === 0) {
          console.error('Error: Invalid arguments. Use: reorder <tripId> <dayNumber> <activityId1> <activityId2> ...');
          process.exit(1);
        }
        await skill.reorderActivities(tripId, dayNumber, activityIds);
        console.log('Activities reordered successfully!');
        break;
      }

      case 'move': {
        const activityId = parseInt(args[1]);
        const newDay = parseInt(args[2]);
        if (isNaN(activityId) || isNaN(newDay)) {
          console.error('Error: Invalid arguments. Use: move <activityId> <newDayNumber>');
          process.exit(1);
        }
        const options = parseArgs(args.slice(3));
        const activity = await skill.moveActivityToDay(activityId, newDay, options.order ? parseInt(options.order) : undefined);
        if (!activity) {
          console.error('Error: Activity not found');
          process.exit(1);
        }
        console.log('Activity moved successfully!');
        console.log(`Now on Day ${activity.dayNumber}`);
        break;
      }

      case 'schedule': {
        const tripId = parseInt(args[1]);
        if (isNaN(tripId)) {
          console.error('Error: Invalid trip ID');
          process.exit(1);
        }
        const schedule = await skill.generateSchedule(tripId);
        const trip = await skill.getTrip(tripId);
        console.log(`\n📍 ${trip?.name || 'Trip'} - Day-by-Day Schedule\n`);
        for (const day of schedule) {
          console.log(`Day ${day.dayNumber} (${day.date}):`);
          console.log('═'.repeat(50));
          if (day.activities.length === 0) {
            console.log('  No activities planned\n');
          } else {
            for (const activity of day.activities) {
              const time = activity.startTime ? `🕐 ${formatTime(activity.startTime)}` : '📌';
              console.log(`  ${time} ${activity.title}`);
              if (activity.location) console.log(`     📍 ${activity.location}`);
              if (activity.duration) console.log(`     ⏱️ ${activity.duration} min`);
              // Travel time estimate to next activity
              const idx = day.activities.indexOf(activity);
              if (idx < day.activities.length - 1) {
                const nextActivity = day.activities[idx + 1];
                const travelTime = skill.estimateTravelTime(activity, nextActivity);
                console.log(`     ↓ ~${travelTime} min travel`);
              }
            }
            console.log();
          }
        }
        break;
      }

      case 'export': {
        const tripId = parseInt(args[1]);
        const filePath = args[2];
        if (isNaN(tripId)) {
          console.error('Error: Invalid trip ID');
          process.exit(1);
        }
        const outputPath = await skill.exportToHTML(tripId, filePath);
        console.log(`Itinerary exported to: ${outputPath}`);
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\n📊 Itinerary Statistics\n');
        console.log(`Total Trips: ${stats.totalTrips}`);
        console.log(`Total Activities: ${stats.totalActivities}`);
        console.log(`Upcoming Trips: ${stats.upcomingTrips}`);
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(health.healthy ? '✅ Healthy' : '❌ Unhealthy');
        console.log(health.message);
        break;
      }

      default:
        console.log('Unknown command. Use "help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
