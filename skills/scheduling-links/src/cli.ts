#!/usr/bin/env node
/**
 * Scheduling Links CLI
 * Command-line interface for managing scheduling links and bookings
 */

import { SchedulingLinksSkill } from './index';

const skill = new SchedulingLinksSkill();

function printUsage() {
  console.log(`
Scheduling Links CLI - Manage booking links and appointments

Usage: scheduling-links <command> [options]

Commands:
  Meeting Types:
    type-create <slug> <name> <duration> [--desc <desc>] [--color <color>]
                Create a new meeting type
    type-list [--all]           List meeting types
    type-get <slug>             Get meeting type details
    type-update <slug> [options]  Update meeting type
    type-enable <slug>          Enable a meeting type
    type-disable <slug>         Disable a meeting type
    type-delete <slug>          Delete a meeting type

  Availability:
    availability <slug>         Show availability for meeting type
    set-availability <slug> <windows>
                Set availability windows (e.g., "1:09:00-17:00,2:09:00-17:00")

  Booking Links:
    link-create <type-slug> <slug> [options]
                Create a new booking link
    link-list [--all]           List booking links
    link-get <slug>             Get booking link details
    link-update <slug> [options]  Update booking link
    link-enable <slug>          Enable a booking link
    link-disable <slug>         Disable a booking link
    link-delete <slug>          Delete a booking link
    link-url <slug> [--base <url>]  Generate booking URL
    widget <slug> [options]     Generate embed widget code

  Bookings:
    slots <slug> <date>         Get available slots for date (YYYY-MM-DD)
    book <slug> <datetime> <name> <email> [options]
                Book an appointment
    bookings <slug> [--status <status>]  List bookings for link
    upcoming                    List all upcoming bookings
    cancel <booking-id>         Cancel a booking
    no-show <booking-id>        Mark booking as no-show

  General:
    status, health              Check system health
    stats                       Show statistics

Options:
  --desc, -d <description>    Description
  --color <color>            Color hex code (default: #4285f4)
  --title <title>            Link title
  --welcome <message>        Welcome message
  --confirm <message>        Confirmation message
  --phone-required           Require phone number
  --notes-required           Require notes
  --buffer-before <mins>     Buffer minutes before
  --buffer-after <mins>      Buffer minutes after
  --max-days <days>          Max advance booking days (default: 30)
  --min-hours <hours>        Min advance booking hours (default: 24)
  --width <width>            Widget width (default: 100%)
  --height <height>          Widget height (default: 600px)
  --theme <theme>            Widget theme: light|dark (default: light)
  --base <url>               Base URL for booking links
  --phone <phone>            Phone number for booking
  --notes <notes>            Notes for booking
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      // ==================== Meeting Types ====================
      case 'type-create': {
        const slug = args[1];
        const name = args[2];
        const duration = parseInt(args[3]);
        
        if (!slug || !name || isNaN(duration)) {
          console.error('Usage: type-create <slug> <name> <duration>');
          process.exit(1);
        }

        const descIdx = args.indexOf('--desc') !== -1 ? args.indexOf('--desc') : args.indexOf('-d');
        const description = descIdx !== -1 ? args[descIdx + 1] : undefined;
        
        const colorIdx = args.indexOf('--color');
        const color = colorIdx !== -1 ? args[colorIdx + 1] : undefined;

        const type = await skill.createMeetingType({
          slug,
          name,
          duration,
          description,
          color
        });

        console.log('Meeting type created:');
        console.log(`  ID: ${type.id}`);
        console.log(`  Slug: ${type.slug}`);
        console.log(`  Name: ${type.name}`);
        console.log(`  Duration: ${type.duration} minutes`);
        console.log(`  Color: ${type.color}`);
        if (type.description) console.log(`  Description: ${type.description}`);
        console.log('\nDefault availability: Monday-Friday 9:00-17:00');
        break;
      }

      case 'type-list': {
        const activeOnly = !args.includes('--all');
        const types = await skill.getMeetingTypes(activeOnly);

        if (types.length === 0) {
          console.log('No meeting types found.');
        } else {
          console.log('Meeting Types:');
          console.log('-'.repeat(80));
          console.log(`${'Slug'.padEnd(20)} ${'Name'.padEnd(25)} ${'Duration'.padEnd(12)} ${'Status'}`);
          console.log('-'.repeat(80));
          types.forEach(t => {
            const status = t.isActive ? 'active' : 'inactive';
            console.log(`${t.slug.padEnd(20)} ${t.name.padEnd(25)} ${(t.duration + ' min').padEnd(12)} ${status}`);
          });
        }
        break;
      }

      case 'type-get': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: type-get <slug>');
          process.exit(1);
        }

        const type = await skill.getMeetingTypeBySlug(slug);
        if (!type) {
          console.error(`Meeting type not found: ${slug}`);
          process.exit(1);
        }

        console.log('Meeting Type:');
        console.log(`  ID: ${type.id}`);
        console.log(`  Slug: ${type.slug}`);
        console.log(`  Name: ${type.name}`);
        console.log(`  Duration: ${type.duration} minutes`);
        console.log(`  Color: ${type.color}`);
        console.log(`  Status: ${type.isActive ? 'active' : 'inactive'}`);
        if (type.description) console.log(`  Description: ${type.description}`);

        // Show availability
        const windows = await skill.getAvailabilityWindows(slug);
        console.log('\nAvailability:');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        windows.forEach(w => {
          console.log(`  ${days[w.dayOfWeek]}: ${w.startTime} - ${w.endTime}`);
        });
        break;
      }

      case 'type-update': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: type-update <slug> [--name <name>] [--desc <desc>] [--duration <mins>] [--color <color>]');
          process.exit(1);
        }

        const updates: any = {};
        const nameIdx = args.indexOf('--name');
        if (nameIdx !== -1) updates.name = args[nameIdx + 1];
        
        const descIdx = args.indexOf('--desc') !== -1 ? args.indexOf('--desc') : args.indexOf('-d');
        if (descIdx !== -1) updates.description = args[descIdx + 1];
        
        const durationIdx = args.indexOf('--duration');
        if (durationIdx !== -1) updates.duration = parseInt(args[durationIdx + 1]);
        
        const colorIdx = args.indexOf('--color');
        if (colorIdx !== -1) updates.color = args[colorIdx + 1];

        const success = await skill.updateMeetingType(slug, updates);
        if (success) {
          console.log('Meeting type updated successfully.');
        } else {
          console.error('Failed to update meeting type.');
          process.exit(1);
        }
        break;
      }

      case 'type-enable': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: type-enable <slug>');
          process.exit(1);
        }
        const success = await skill.setMeetingTypeActive(slug, true);
        console.log(success ? 'Meeting type enabled.' : 'Failed to enable meeting type.');
        break;
      }

      case 'type-disable': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: type-disable <slug>');
          process.exit(1);
        }
        const success = await skill.setMeetingTypeActive(slug, false);
        console.log(success ? 'Meeting type disabled.' : 'Failed to disable meeting type.');
        break;
      }

      case 'type-delete': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: type-delete <slug>');
          process.exit(1);
        }
        const success = await skill.deleteMeetingType(slug);
        console.log(success ? 'Meeting type deleted.' : 'Failed to delete meeting type.');
        break;
      }

      // ==================== Availability ====================
      case 'availability': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: availability <meeting-type-slug>');
          process.exit(1);
        }

        const windows = await skill.getAvailabilityWindows(slug);
        if (windows.length === 0) {
          console.log('No availability windows set.');
        } else {
          console.log('Availability Windows:');
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          windows.forEach(w => {
            console.log(`  ${days[w.dayOfWeek]}: ${w.startTime} - ${w.endTime}`);
          });
        }
        break;
      }

      case 'set-availability': {
        const slug = args[1];
        const windowsStr = args[2];
        
        if (!slug || !windowsStr) {
          console.error('Usage: set-availability <slug> "day:start-end,day:start-end"');
          console.error('  Example: set-availability consult "1:09:00-17:00,2:09:00-17:00,3:09:00-17:00"');
          process.exit(1);
        }

        const windows: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
        const windowParts = windowsStr.split(',');
        
        for (const part of windowParts) {
          const match = part.match(/(\d+):(\d{2}:\d{2})-(\d{2}:\d{2})/);
          if (match) {
            windows.push({
              dayOfWeek: parseInt(match[1]),
              startTime: match[2],
              endTime: match[3]
            });
          }
        }

        const success = await skill.setAvailabilityWindows(slug, windows);
        if (success) {
          console.log('Availability windows updated.');
        } else {
          console.error('Failed to update availability windows.');
          process.exit(1);
        }
        break;
      }

      // ==================== Booking Links ====================
      case 'link-create': {
        const typeSlug = args[1];
        const slug = args[2];
        
        if (!typeSlug || !slug) {
          console.error('Usage: link-create <type-slug> <link-slug> [options]');
          process.exit(1);
        }

        const options: any = {
          meetingTypeSlug: typeSlug,
          slug
        };

        const titleIdx = args.indexOf('--title');
        if (titleIdx !== -1) options.title = args[titleIdx + 1];
        
        const welcomeIdx = args.indexOf('--welcome');
        if (welcomeIdx !== -1) options.welcomeMessage = args[welcomeIdx + 1];
        
        const confirmIdx = args.indexOf('--confirm');
        if (confirmIdx !== -1) options.confirmationMessage = args[confirmIdx + 1];

        options.requirePhone = args.includes('--phone-required');
        options.requireNotes = args.includes('--notes-required');

        const bufferBeforeIdx = args.indexOf('--buffer-before');
        if (bufferBeforeIdx !== -1) options.bufferMinutesBefore = parseInt(args[bufferBeforeIdx + 1]);
        
        const bufferAfterIdx = args.indexOf('--buffer-after');
        if (bufferAfterIdx !== -1) options.bufferMinutesAfter = parseInt(args[bufferAfterIdx + 1]);
        
        const maxDaysIdx = args.indexOf('--max-days');
        if (maxDaysIdx !== -1) options.maxAdvanceDays = parseInt(args[maxDaysIdx + 1]);
        
        const minHoursIdx = args.indexOf('--min-hours');
        if (minHoursIdx !== -1) options.minAdvanceHours = parseInt(args[minHoursIdx + 1]);

        const link = await skill.createBookingLink(options);
        console.log('Booking link created:');
        console.log(`  ID: ${link.id}`);
        console.log(`  Slug: ${link.slug}`);
        console.log(`  Title: ${link.title}`);
        console.log(`  URL: /book/${link.slug}`);
        break;
      }

      case 'link-list': {
        const activeOnly = !args.includes('--all');
        const links = await skill.getBookingLinks(activeOnly);
        const types = await skill.getMeetingTypes();
        const typeMap = new Map(types.map(t => [t.id, t]));

        if (links.length === 0) {
          console.log('No booking links found.');
        } else {
          console.log('Booking Links:');
          console.log('-'.repeat(100));
          console.log(`${'Slug'.padEnd(20)} ${'Title'.padEnd(25)} ${'Duration'.padEnd(12)} ${'Status'}`);
          console.log('-'.repeat(100));
          links.forEach(l => {
            const type = typeMap.get(l.meetingTypeId);
            const status = l.isActive ? 'active' : 'inactive';
            const duration = type ? `${type.duration} min` : '?';
            console.log(`${l.slug.padEnd(20)} ${l.title.padEnd(25)} ${duration.padEnd(12)} ${status}`);
          });
        }
        break;
      }

      case 'link-get': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: link-get <slug>');
          process.exit(1);
        }

        const link = await skill.getBookingLinkBySlug(slug);
        if (!link) {
          console.error(`Booking link not found: ${slug}`);
          process.exit(1);
        }

        const type = await skill.getMeetingTypeById(link.meetingTypeId);

        console.log('Booking Link:');
        console.log(`  ID: ${link.id}`);
        console.log(`  Slug: ${link.slug}`);
        console.log(`  Title: ${link.title}`);
        console.log(`  Meeting Type: ${type?.name || 'Unknown'} (${link.meetingTypeId})`);
        console.log(`  Status: ${link.isActive ? 'active' : 'inactive'}`);
        console.log(`  Duration: ${type?.duration || '?'} minutes`);
        console.log(`  Buffers: ${link.bufferMinutesBefore} min before, ${link.bufferMinutesAfter} min after`);
        console.log(`  Booking Window: ${link.minAdvanceHours} hours to ${link.maxAdvanceDays} days in advance`);
        console.log(`  Required Fields: email${link.requirePhone ? ', phone' : ''}${link.requireNotes ? ', notes' : ''}`);
        if (link.welcomeMessage) console.log(`  Welcome: ${link.welcomeMessage}`);
        if (link.confirmationMessage) console.log(`  Confirmation: ${link.confirmationMessage}`);
        break;
      }

      case 'link-update': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: link-update <slug> [options]');
          process.exit(1);
        }

        const updates: any = {};
        
        const titleIdx = args.indexOf('--title');
        if (titleIdx !== -1) updates.title = args[titleIdx + 1];
        
        const welcomeIdx = args.indexOf('--welcome');
        if (welcomeIdx !== -1) updates.welcomeMessage = args[welcomeIdx + 1];
        
        const confirmIdx = args.indexOf('--confirm');
        if (confirmIdx !== -1) updates.confirmationMessage = args[confirmIdx + 1];

        if (args.includes('--phone-required')) updates.requirePhone = true;
        if (args.includes('--no-phone-required')) updates.requirePhone = false;
        if (args.includes('--notes-required')) updates.requireNotes = true;
        if (args.includes('--no-notes-required')) updates.requireNotes = false;

        const bufferBeforeIdx = args.indexOf('--buffer-before');
        if (bufferBeforeIdx !== -1) updates.bufferMinutesBefore = parseInt(args[bufferBeforeIdx + 1]);
        
        const bufferAfterIdx = args.indexOf('--buffer-after');
        if (bufferAfterIdx !== -1) updates.bufferMinutesAfter = parseInt(args[bufferAfterIdx + 1]);
        
        const maxDaysIdx = args.indexOf('--max-days');
        if (maxDaysIdx !== -1) updates.maxAdvanceDays = parseInt(args[maxDaysIdx + 1]);
        
        const minHoursIdx = args.indexOf('--min-hours');
        if (minHoursIdx !== -1) updates.minAdvanceHours = parseInt(args[minHoursIdx + 1]);

        const success = await skill.updateBookingLink(slug, updates);
        if (success) {
          console.log('Booking link updated successfully.');
        } else {
          console.error('Failed to update booking link.');
          process.exit(1);
        }
        break;
      }

      case 'link-enable': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: link-enable <slug>');
          process.exit(1);
        }
        const success = await skill.setBookingLinkActive(slug, true);
        console.log(success ? 'Booking link enabled.' : 'Failed to enable booking link.');
        break;
      }

      case 'link-disable': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: link-disable <slug>');
          process.exit(1);
        }
        const success = await skill.setBookingLinkActive(slug, false);
        console.log(success ? 'Booking link disabled.' : 'Failed to disable booking link.');
        break;
      }

      case 'link-delete': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: link-delete <slug>');
          process.exit(1);
        }
        const success = await skill.deleteBookingLink(slug);
        console.log(success ? 'Booking link deleted.' : 'Failed to delete booking link.');
        break;
      }

      case 'link-url': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: link-url <slug> [--base <url>]');
          process.exit(1);
        }

        const baseIdx = args.indexOf('--base');
        const baseUrl = baseIdx !== -1 ? args[baseIdx + 1] : undefined;

        const url = skill.generateBookingUrl(slug, baseUrl);
        console.log(url);
        break;
      }

      case 'widget': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: widget <slug> [--width <w>] [--height <h>] [--theme <theme>]');
          process.exit(1);
        }

        const options: any = {};
        const widthIdx = args.indexOf('--width');
        if (widthIdx !== -1) options.width = args[widthIdx + 1];
        
        const heightIdx = args.indexOf('--height');
        if (heightIdx !== -1) options.height = args[heightIdx + 1];
        
        const themeIdx = args.indexOf('--theme');
        if (themeIdx !== -1) options.theme = args[themeIdx + 1];

        const code = skill.generateWidgetCode(slug, options);
        console.log('Embed this code in your website:');
        console.log('');
        console.log(code);
        break;
      }

      // ==================== Bookings ====================
      case 'slots': {
        const slug = args[1];
        const dateStr = args[2];
        
        if (!slug || !dateStr) {
          console.error('Usage: slots <link-slug> <YYYY-MM-DD>');
          process.exit(1);
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.error('Invalid date format. Use YYYY-MM-DD');
          process.exit(1);
        }

        const slots = await skill.getAvailableSlots(slug, date);
        
        if (slots.length === 0) {
          console.log('No available slots for this date.');
        } else {
          console.log(`Available slots for ${dateStr}:`);
          slots.forEach((slot, i) => {
            const start = new Date(slot.start);
            const time = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            console.log(`  ${i + 1}. ${time}`);
          });
        }
        break;
      }

      case 'book': {
        const slug = args[1];
        const datetime = args[2];
        const name = args[3];
        const email = args[4];

        if (!slug || !datetime || !name || !email) {
          console.error('Usage: book <link-slug> <datetime> <name> <email> [options]');
          console.error('  Example: book consult "2024-02-15T10:00:00" "John Doe" "john@example.com"');
          process.exit(1);
        }

        const options: any = {
          linkSlug: slug,
          name,
          email,
          startTime: datetime
        };

        const phoneIdx = args.indexOf('--phone');
        if (phoneIdx !== -1) options.phone = args[phoneIdx + 1];
        
        const notesIdx = args.indexOf('--notes');
        if (notesIdx !== -1) options.notes = args[notesIdx + 1];

        const booking = await skill.bookAppointment(options);
        
        console.log('Appointment booked successfully!');
        console.log(`  Booking ID: ${booking.id}`);
        console.log(`  Name: ${booking.name}`);
        console.log(`  Email: ${booking.email}`);
        console.log(`  Start: ${new Date(booking.startTime).toLocaleString()}`);
        console.log(`  End: ${new Date(booking.endTime).toLocaleString()}`);
        if (booking.calendarEventId) {
          console.log(`  Calendar Event: Created`);
        }
        break;
      }

      case 'bookings': {
        const slug = args[1];
        if (!slug) {
          console.error('Usage: bookings <link-slug> [--status <status>]');
          process.exit(1);
        }

        const statusIdx = args.indexOf('--status');
        const status = statusIdx !== -1 ? args[statusIdx + 1] : undefined;

        const bookings = await skill.getBookings(slug, status);
        
        if (bookings.length === 0) {
          console.log('No bookings found.');
        } else {
          console.log('Bookings:');
          console.log('-'.repeat(100));
          console.log(`${'ID'.padEnd(6)} ${'Name'.padEnd(25)} ${'Email'.padEnd(25)} ${'Time'.padEnd(25)} ${'Status'}`);
          console.log('-'.repeat(100));
          bookings.forEach(b => {
            const time = new Date(b.startTime).toLocaleString();
            console.log(`${String(b.id).padEnd(6)} ${b.name.substring(0, 25).padEnd(25)} ${b.email.substring(0, 25).padEnd(25)} ${time.padEnd(25)} ${b.status}`);
          });
        }
        break;
      }

      case 'upcoming': {
        const bookings = await skill.getUpcomingBookings();
        
        if (bookings.length === 0) {
          console.log('No upcoming bookings.');
        } else {
          console.log('Upcoming Bookings:');
          console.log('-'.repeat(110));
          console.log(`${'ID'.padEnd(6)} ${'Type'.padEnd(20)} ${'Name'.padEnd(20)} ${'Email'.padEnd(25)} ${'Time'}`);
          console.log('-'.repeat(110));
          bookings.forEach(b => {
            const time = new Date(b.startTime).toLocaleString();
            console.log(`${String(b.id).padEnd(6)} ${b.meetingTypeName.substring(0, 20).padEnd(20)} ${b.name.substring(0, 20).padEnd(20)} ${b.email.substring(0, 25).padEnd(25)} ${time}`);
          });
        }
        break;
      }

      case 'cancel': {
        const bookingId = parseInt(args[1]);
        if (isNaN(bookingId)) {
          console.error('Usage: cancel <booking-id>');
          process.exit(1);
        }

        const success = await skill.cancelBooking(bookingId);
        console.log(success ? 'Booking cancelled.' : 'Failed to cancel booking.');
        break;
      }

      case 'no-show': {
        const bookingId = parseInt(args[1]);
        if (isNaN(bookingId)) {
          console.error('Usage: no-show <booking-id>');
          process.exit(1);
        }

        const success = await skill.markNoShow(bookingId);
        console.log(success ? 'Booking marked as no-show.' : 'Failed to update booking.');
        break;
      }

      // ==================== General ====================
      case 'status':
      case 'health': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.healthy ? 'OK' : 'ERROR'}`);
        console.log(`Message: ${health.message}`);
        if (health.calendarConnected !== undefined) {
          console.log(`Calendar: ${health.calendarConnected ? 'Connected' : 'Not Connected'}`);
        }
        if (!health.healthy) process.exit(1);
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('Scheduling Links Statistics:');
        console.log(`  Meeting Types: ${stats.meetingTypes}`);
        console.log(`  Active Booking Links: ${stats.bookingLinks}`);
        console.log(`  Total Bookings: ${stats.totalBookings}`);
        console.log(`  Upcoming Bookings: ${stats.upcomingBookings}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
