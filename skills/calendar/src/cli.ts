#!/usr/bin/env node
/**
 * Calendar Skill CLI
 * Command-line interface for Google Calendar integration
 */

import { CalendarSkill, CreateEventOptions, RecurrenceRule } from './index';

const command = process.argv[2];
const args = process.argv.slice(3);

const profile = process.env.OPENCLAW_PROFILE || 'default';
const calendar = new CalendarSkill({ profile });

async function main() {
  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;
      case 'list':
        await listEvents();
        break;
      case 'calendars':
        await listCalendars();
        break;
      case 'create':
        await createEvent();
        break;
      case 'get':
        await getEvent();
        break;
      case 'update':
        await updateEvent();
        break;
      case 'delete':
        await deleteEvent();
        break;
      case 'free':
        await findFreeTime();
        break;
      case 'upcoming':
        await upcomingEvents();
        break;
      case 'today':
        await todayEvents();
        break;
      case 'health':
        await healthCheck();
        break;
      default:
        showHelp();
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await calendar.close();
  }
}

async function showStatus() {
  const status = await calendar.getStatus();
  
  if (status.connected) {
    console.log(`✓ Connected to Google Calendar`);
    console.log(`  Email: ${status.email}`);
    console.log(`  Calendar Scope: ${status.hasCalendarScope ? '✓' : '✗'}`);
  } else {
    console.log(`✗ Not connected to Google`);
    console.log(`\nRun 'npx @openclaw/google-oauth connect calendar' to authenticate`);
  }
}

async function listCalendars() {
  const calendars = await calendar.listCalendars();
  
  console.log(`\nCalendars (${calendars.length}):`);
  console.log('-'.repeat(60));
  
  for (const cal of calendars) {
    const primary = cal.primary ? ' [PRIMARY]' : '';
    console.log(`${cal.summary}${primary}`);
    console.log(`  ID: ${cal.id}`);
    if (cal.description) {
      console.log(`  Description: ${cal.description}`);
    }
    if (cal.timeZone) {
      console.log(`  Time Zone: ${cal.timeZone}`);
    }
    console.log();
  }
}

async function listEvents() {
  const maxResults = parseInt(getArg('--max') || '20');
  const days = parseInt(getArg('--days') || '7');
  const query = getArg('--query');
  const calendarId = getArg('--calendar');
  
  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMin.getDate() + days);
  
  const result = await calendar.listEvents({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults,
    query,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  console.log(`\nEvents (${result.events.length}):`);
  console.log('-'.repeat(60));
  
  for (const event of result.events) {
    printEvent(event);
  }
  
  if (result.nextPageToken) {
    console.log('\n(More events available, use --page-token to fetch next page)');
  }
}

async function getEvent() {
  const eventId = args[0];
  if (!eventId) {
    console.error('Usage: calendar get <event-id> [--calendar <id>]');
    process.exit(1);
  }
  
  const calendarId = getArg('--calendar');
  const event = await calendar.getEvent(eventId, calendarId);
  
  console.log('\nEvent Details:');
  console.log('='.repeat(60));
  printEvent(event, true);
}

async function createEvent() {
  const summary = getArg('--summary') || getArg('-s');
  if (!summary) {
    console.error('Usage: calendar create --summary "Event Title" [options]');
    console.log('\nOptions:');
    console.log('  --summary, -s    Event title (required)');
    console.log('  --description    Event description');
    console.log('  --location       Event location');
    console.log('  --start          Start time (ISO format)');
    console.log('  --end            End time (ISO format)');
    console.log('  --duration       Duration in minutes (default: 60)');
    console.log('  --attendees      Comma-separated email addresses');
    console.log('  --calendar       Calendar ID (default: primary)');
    process.exit(1);
  }
  
  const startArg = getArg('--start');
  const endArg = getArg('--end');
  const duration = parseInt(getArg('--duration') || '60');
  
  let start: { dateTime: string; timeZone?: string };
  let end: { dateTime: string; timeZone?: string };
  
  if (startArg) {
    start = { dateTime: new Date(startArg).toISOString() };
    if (endArg) {
      end = { dateTime: new Date(endArg).toISOString() };
    } else {
      const endDate = new Date(new Date(startArg).getTime() + duration * 60 * 1000);
      end = { dateTime: endDate.toISOString() };
    }
  } else {
    // Default to next hour
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    start = { dateTime: now.toISOString() };
    const endDate = new Date(now.getTime() + duration * 60 * 1000);
    end = { dateTime: endDate.toISOString() };
  }
  
  const options: CreateEventOptions = {
    summary,
    description: getArg('--description'),
    location: getArg('--location'),
    start,
    end,
  };
  
  const attendeesArg = getArg('--attendees');
  if (attendeesArg) {
    options.attendees = attendeesArg.split(',').map(email => ({
      email: email.trim(),
    }));
  }
  
  const calendarId = getArg('--calendar');
  const event = await calendar.createEvent(options, calendarId);
  
  console.log('\n✓ Event created successfully');
  console.log(`  Title: ${event.summary}`);
  console.log(`  ID: ${event.id}`);
  console.log(`  Link: ${event.htmlLink}`);
  
  if (event.start.dateTime) {
    console.log(`  Start: ${formatDateTime(event.start.dateTime)}`);
  }
  if (event.end.dateTime) {
    console.log(`  End: ${formatDateTime(event.end.dateTime)}`);
  }
}

async function updateEvent() {
  const eventId = args[0];
  if (!eventId) {
    console.error('Usage: calendar update <event-id> [options]');
    console.log('\nOptions:');
    console.log('  --summary        New title');
    console.log('  --description    New description');
    console.log('  --location       New location');
    console.log('  --start          New start time (ISO format)');
    console.log('  --end            New end time (ISO format)');
    console.log('  --status         Event status (confirmed, tentative, cancelled)');
    console.log('  --calendar       Calendar ID (default: primary)');
    process.exit(1);
  }
  
  const options: Record<string, any> = {};
  
  if (getArg('--summary')) options.summary = getArg('--summary');
  if (getArg('--description')) options.description = getArg('--description');
  if (getArg('--location')) options.location = getArg('--location');
  if (getArg('--status')) options.status = getArg('--status');
  
  if (getArg('--start')) {
    options.start = { dateTime: new Date(getArg('--start')!).toISOString() };
  }
  if (getArg('--end')) {
    options.end = { dateTime: new Date(getArg('--end')!).toISOString() };
  }
  
  const calendarId = getArg('--calendar');
  const event = await calendar.updateEvent(eventId, options, calendarId);
  
  console.log('\n✓ Event updated successfully');
  console.log(`  Title: ${event.summary}`);
  console.log(`  ID: ${event.id}`);
}

async function deleteEvent() {
  const eventId = args[0];
  if (!eventId) {
    console.error('Usage: calendar delete <event-id> [--calendar <id>]');
    process.exit(1);
  }
  
  const calendarId = getArg('--calendar');
  await calendar.deleteEvent(eventId, calendarId);
  
  console.log(`✓ Event ${eventId} deleted successfully`);
}

async function findFreeTime() {
  const duration = parseInt(getArg('--duration') || '60');
  const days = parseInt(getArg('--days') || '7');
  
  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMin.getDate() + days);
  
  const calendarsArg = getArg('--calendars');
  const calendars = calendarsArg ? calendarsArg.split(',') : undefined;
  
  const slots = await calendar.findFreeTime({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    duration,
    calendars,
  });
  
  console.log(`\nAvailable time slots (${slots.length}):`);
  console.log('-'.repeat(60));
  
  for (const slot of slots.slice(0, 10)) {
    console.log(`  ${formatDateTime(slot.start)} - ${formatTime(slot.end)}`);
  }
  
  if (slots.length > 10) {
    console.log(`\n  ... and ${slots.length - 10} more slots`);
  }
}

async function upcomingEvents() {
  const maxResults = parseInt(getArg('--max') || '10');
  const days = parseInt(getArg('--days') || '7');
  const calendarId = getArg('--calendar');
  
  const events = await calendar.getUpcomingEvents({ calendarId, maxResults, days });
  
  console.log(`\nUpcoming events (${events.length}):`);
  console.log('-'.repeat(60));
  
  for (const event of events) {
    printEvent(event);
  }
}

async function todayEvents() {
  const calendarId = getArg('--calendar');
  const events = await calendar.getTodayEvents(calendarId);
  
  console.log(`\nToday's events (${events.length}):`);
  console.log('-'.repeat(60));
  
  for (const event of events) {
    printEvent(event);
  }
}

async function healthCheck() {
  const result = await calendar.healthCheck();
  
  console.log(`\nHealth Check: ${result.status.toUpperCase()}`);
  console.log('-'.repeat(40));
  
  if (result.email) {
    console.log(`Email: ${result.email}`);
  }
  if (result.message) {
    console.log(`Message: ${result.message}`);
  }
  
  process.exit(result.status === 'healthy' ? 0 : 1);
}

// Helper functions

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

function printEvent(event: import('./index').CalendarEvent, detailed = false) {
  const start = event.start.dateTime || event.start.date;
  const end = event.end.dateTime || event.end.date;
  const isAllDay = !!event.start.date;
  
  console.log(`\n${event.summary}`);
  console.log(`  ID: ${event.id}`);
  
  if (isAllDay) {
    console.log(`  Date: ${event.start.date}${event.end.date !== event.start.date ? ` - ${event.end.date}` : ''} (All day)`);
  } else {
    console.log(`  Time: ${formatDateTime(start!)} - ${formatTime(end!)}`);
  }
  
  if (event.location) {
    console.log(`  Location: ${event.location}`);
  }
  
  if (event.attendees && event.attendees.length > 0) {
    console.log(`  Attendees: ${event.attendees.length}`);
    if (detailed) {
      for (const attendee of event.attendees) {
        const status = attendee.responseStatus ? ` (${attendee.responseStatus})` : '';
        const name = attendee.displayName || attendee.email;
        console.log(`    - ${name}${status}`);
      }
    }
  }
  
  if (event.recurrence) {
    console.log(`  Recurring: ${event.recurrence.length} rule(s)`);
  }
  
  if (detailed && event.description) {
    console.log(`  Description: ${event.description.substring(0, 200)}${event.description.length > 200 ? '...' : ''}`);
  }
  
  if (detailed) {
    console.log(`  Status: ${event.status}`);
    console.log(`  Link: ${event.htmlLink}`);
  }
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function showHelp() {
  console.log(`
Calendar Skill CLI

Usage: calendar <command> [options]

Commands:
  status              Show connection status
  calendars           List available calendars
  list                List events [options: --max, --days, --query, --calendar]
  upcoming            Show upcoming events [--max, --days, --calendar]
  today               Show today's events [--calendar]
  get <id>            Get event details [--calendar]
  create              Create new event [--summary, --description, --location, --start, --end, --duration, --attendees, --calendar]
  update <id>         Update event [--summary, --description, --location, --start, --end, --status, --calendar]
  delete <id>         Delete event [--calendar]
  free                Find free time slots [--duration, --days, --calendars]
  health              Run health check

Environment Variables:
  OPENCLAW_PROFILE    Profile to use (default: default)
`);
}

main();
