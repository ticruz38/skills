#!/usr/bin/env node
/**
 * Reservation Manager CLI
 * Command-line interface for restaurant table reservation system
 */

import { ReservationManager, Table, Reservation } from './index';

const args = process.argv.slice(2);
const command = args[0];

async function showHelp() {
  console.log(`
Reservation Manager CLI

Commands:
  status                    Show connection status
  health                    Check system health
  
  Table Management:
  tables                    List all tables
  table-add                 Add a new table
  table-get <id>            Get table details
  table-update <id>         Update a table
  table-delete <id>         Delete a table
  
  Reservation Management:
  reservations              List reservations
  book                      Create a new reservation
  get <id>                  Get reservation details
  update <id>               Update a reservation
  cancel <id>               Cancel a reservation
  delete <id>               Delete a reservation
  seat <id>                 Mark reservation as seated
  complete <id>             Mark reservation as completed
  no-show <id>              Mark reservation as no-show
  
  Availability:
  available <date>          Check availability for date (YYYY-MM-DD)
  slots <date>              Show available time slots
  
  Configuration:
  config                    Show restaurant configuration
  config-set                Update configuration
  
  SMS & Notifications:
  reminders                 Send SMS reminders for today's reservations
  
  Statistics:
  stats                     Show reservation statistics

Options:
  --profile <name>          Use specific profile (default: default)
  --name <name>             Table or guest name
  --number <num>            Table number
  --capacity <num>          Table capacity
  --section <name>          Table section
  --party <size>            Party size
  --date <date>             Date (YYYY-MM-DD)
  --time <time>             Time (HH:MM)
  --duration <mins>         Duration in minutes
  --phone <number>          Guest phone number
  --email <email>           Guest email
  --table <id>              Table ID
  --requests <text>         Special requests
  --occasion <text>         Occasion (birthday, anniversary, etc.)
  --source <source>         Source (phone, walk_in, online, third_party)
  --status <status>         Filter by status
  --from <date>             From date
  --to <date>               To date
  --value <value>           Configuration value
`);
}

function parseArgs(): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      options[key] = value;
      if (value !== 'true') i++;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const profile = options.profile || 'default';
  const manager = new ReservationManager({ profile });

  try {
    switch (command) {
      case 'status': {
        const status = await manager.getStatus();
        console.log('\nConnection Status');
        console.log('=================');
        console.log(`Calendar: ${status.calendarConnected ? '✓ connected' : '✗ not connected'}`);
        if (status.email) {
          console.log(`Email: ${status.email}`);
        }
        break;
      }

      case 'health': {
        const health = await manager.healthCheck();
        console.log('\nHealth Check');
        console.log('=============');
        console.log(`Status: ${health.status}`);
        console.log(`Message: ${health.message}`);
        console.log(`Calendar: ${health.calendarStatus}`);
        console.log(`Tables: ${health.tables}`);
        console.log(`Reservations: ${health.reservations}`);
        break;
      }

      case 'tables': {
        const tables = await manager.listTables({ activeOnly: options.active === 'true' });
        console.log('\nTables');
        console.log('======');
        if (tables.length === 0) {
          console.log('No tables configured. Use "table-add" to add tables.');
        } else {
          console.log(`ID | # | Name | Capacity | Section | Status`);
          console.log('-'.repeat(60));
          for (const t of tables) {
            const status = t.isActive ? 'active' : 'inactive';
            console.log(`${t.id.slice(0, 8)}... | ${t.number} | ${t.name} | ${t.capacity} | ${t.section} | ${status}`);
          }
          console.log(`\nTotal: ${tables.length} tables`);
        }
        break;
      }

      case 'table-add': {
        if (!options.name || !options.number || !options.capacity) {
          console.log('Error: --name, --number, and --capacity are required');
          process.exit(1);
        }
        const table = await manager.addTable({
          number: parseInt(options.number),
          name: options.name,
          capacity: parseInt(options.capacity),
          section: options.section,
          isActive: options.active !== 'false',
          notes: options.notes,
        });
        console.log('\nTable Added');
        console.log('===========');
        console.log(`ID: ${table.id}`);
        console.log(`Number: ${table.number}`);
        console.log(`Name: ${table.name}`);
        console.log(`Capacity: ${table.capacity}`);
        console.log(`Section: ${table.section}`);
        break;
      }

      case 'table-get': {
        const id = args[1];
        if (!id) {
          console.log('Error: Table ID required');
          process.exit(1);
        }
        const table = await manager.getTable(id);
        if (!table) {
          console.log('Table not found');
          process.exit(1);
        }
        console.log('\nTable Details');
        console.log('=============');
        console.log(`ID: ${table.id}`);
        console.log(`Number: ${table.number}`);
        console.log(`Name: ${table.name}`);
        console.log(`Capacity: ${table.capacity}`);
        console.log(`Section: ${table.section}`);
        console.log(`Status: ${table.isActive ? 'active' : 'inactive'}`);
        if (table.notes) console.log(`Notes: ${table.notes}`);
        break;
      }

      case 'table-update': {
        const id = args[1];
        if (!id) {
          console.log('Error: Table ID required');
          process.exit(1);
        }
        const updates: Partial<Table> = {};
        if (options.name) updates.name = options.name;
        if (options.number) updates.number = parseInt(options.number);
        if (options.capacity) updates.capacity = parseInt(options.capacity);
        if (options.section) updates.section = options.section;
        if (options.active) updates.isActive = options.active === 'true';
        if (options.notes) updates.notes = options.notes;

        const table = await manager.updateTable(id, updates);
        if (!table) {
          console.log('Table not found');
          process.exit(1);
        }
        console.log('\nTable Updated');
        console.log('=============');
        console.log(`ID: ${table.id}`);
        console.log(`Name: ${table.name}`);
        console.log(`Capacity: ${table.capacity}`);
        break;
      }

      case 'table-delete': {
        const id = args[1];
        if (!id) {
          console.log('Error: Table ID required');
          process.exit(1);
        }
        await manager.deleteTable(id);
        console.log('Table deleted successfully');
        break;
      }

      case 'reservations':
      case 'list': {
        const filter: {
          date?: string;
          fromDate?: string;
          toDate?: string;
          status?: Reservation['status'];
          guestName?: string;
        } = {};
        if (options.date) filter.date = options.date;
        if (options.from) filter.fromDate = options.from;
        if (options.to) filter.toDate = options.to;
        if (options.status) filter.status = options.status as Reservation['status'];
        if (options.name) filter.guestName = options.name;

        const reservations = await manager.listReservations(filter);
        console.log('\nReservations');
        console.log('============');
        if (reservations.length === 0) {
          console.log('No reservations found.');
        } else {
          console.log(`ID | Date | Time | Guest | Party | Status`);
          console.log('-'.repeat(80));
          for (const r of reservations.slice(0, 50)) {
            const shortId = r.id.slice(0, 8) + '...';
            const guest = r.guestName.length > 15 ? r.guestName.slice(0, 15) + '...' : r.guestName;
            console.log(`${shortId} | ${r.date} | ${r.time} | ${guest} | ${r.partySize} | ${r.status}`);
          }
          if (reservations.length > 50) {
            console.log(`\n... and ${reservations.length - 50} more`);
          }
          console.log(`\nTotal: ${reservations.length} reservations`);
        }
        break;
      }

      case 'book':
      case 'create': {
        if (!options.name || !options.phone || !options.date || !options.time || !options.party) {
          console.log('Error: --name, --phone, --date, --time, and --party are required');
          console.log('\nExample: reservation-manager book --name "John Doe" --phone "+1234567890" --date 2026-02-15 --time 19:00 --party 4');
          process.exit(1);
        }
        const reservationData: any = {
          guestName: options.name,
          guestPhone: options.phone,
          guestEmail: options.email,
          partySize: parseInt(options.party),
          date: options.date,
          time: options.time,
          tableId: options.table,
          specialRequests: options.requests,
          occasion: options.occasion,
          source: (options.source as Reservation['source']) || 'phone',
          notes: options.notes,
        };
        if (options.duration) {
          reservationData.duration = parseInt(options.duration);
        }
        const reservation = await manager.createReservation(reservationData);
        console.log('\nReservation Created');
        console.log('===================');
        console.log(`ID: ${reservation.id}`);
        console.log(`Guest: ${reservation.guestName}`);
        console.log(`Phone: ${reservation.guestPhone}`);
        console.log(`Party: ${reservation.partySize}`);
        console.log(`Date: ${reservation.date}`);
        console.log(`Time: ${reservation.time}`);
        console.log(`Duration: ${reservation.duration} min`);
        console.log(`Status: ${reservation.status}`);
        if (reservation.tableId) {
          const table = await manager.getTable(reservation.tableId);
          console.log(`Table: ${table?.name || reservation.tableId}`);
        }
        if (reservation.calendarEventId) {
          console.log(`Calendar: Event created`);
        }
        break;
      }

      case 'get': {
        const id = args[1];
        if (!id) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        const r = await manager.getReservation(id);
        if (!r) {
          console.log('Reservation not found');
          process.exit(1);
        }
        console.log('\nReservation Details');
        console.log('===================');
        console.log(`ID: ${r.id}`);
        console.log(`Guest: ${r.guestName}`);
        console.log(`Phone: ${r.guestPhone}`);
        if (r.guestEmail) console.log(`Email: ${r.guestEmail}`);
        console.log(`Party Size: ${r.partySize}`);
        console.log(`Date: ${r.date}`);
        console.log(`Time: ${r.time}`);
        console.log(`Duration: ${r.duration} min`);
        console.log(`Status: ${r.status}`);
        if (r.tableId) {
          const table = await manager.getTable(r.tableId);
          console.log(`Table: ${table?.name || r.tableId}`);
        }
        if (r.specialRequests) console.log(`Special Requests: ${r.specialRequests}`);
        if (r.occasion) console.log(`Occasion: ${r.occasion}`);
        console.log(`Source: ${r.source}`);
        console.log(`SMS Confirmation: ${r.smsConfirmationSent ? 'sent' : 'not sent'}`);
        console.log(`SMS Reminder: ${r.smsReminderSent ? 'sent' : 'not sent'}`);
        if (r.notes) console.log(`Notes: ${r.notes}`);
        console.log(`Created: ${r.createdAt}`);
        break;
      }

      case 'update': {
        const updateId = args[1];
        if (!updateId) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        const updates: Partial<Reservation> = {};
        if (options.name) updates.guestName = options.name;
        if (options.phone) updates.guestPhone = options.phone;
        if (options.email) updates.guestEmail = options.email;
        if (options.party) updates.partySize = parseInt(options.party);
        if (options.date) updates.date = options.date;
        if (options.time) updates.time = options.time;
        if (options.duration) updates.duration = parseInt(options.duration);
        if (options.table) updates.tableId = options.table;
        if (options.requests) updates.specialRequests = options.requests;
        if (options.occasion) updates.occasion = options.occasion;
        if (options.notes) updates.notes = options.notes;

        const updated = await manager.updateReservation(updateId, updates);
        if (!updated) {
          console.log('Reservation not found');
          process.exit(1);
        }
        console.log('Reservation updated successfully');
        break;
      }

      case 'cancel': {
        const cancelId = args[1];
        if (!cancelId) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        await manager.cancelReservation(cancelId, options.notify !== 'false');
        console.log('Reservation cancelled successfully');
        break;
      }

      case 'delete': {
        const deleteId = args[1];
        if (!deleteId) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        await manager.deleteReservation(deleteId);
        console.log('Reservation deleted successfully');
        break;
      }

      case 'seat': {
        const seatId = args[1];
        if (!seatId) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        await manager.updateReservation(seatId, { status: 'seated' });
        console.log('Reservation marked as seated');
        break;
      }

      case 'complete': {
        const completeId = args[1];
        if (!completeId) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        await manager.updateReservation(completeId, { status: 'completed' });
        console.log('Reservation marked as completed');
        break;
      }

      case 'no-show': {
        const noShowId = args[1];
        if (!noShowId) {
          console.log('Error: Reservation ID required');
          process.exit(1);
        }
        await manager.updateReservation(noShowId, { status: 'no_show' });
        console.log('Reservation marked as no-show');
        break;
      }

      case 'available':
      case 'slots': {
        const date = args[1] || options.date;
        if (!date) {
          console.log('Error: Date required (YYYY-MM-DD)');
          process.exit(1);
        }
        const partySize = options.party ? parseInt(options.party) : undefined;
        const availability = await manager.checkAvailability(date, partySize);
        console.log(`\nAvailability for ${date}${partySize ? ` (party of ${partySize})` : ''}`);
        console.log('='.repeat(50));
        
        const availableSlots = availability.slots.filter(s => s.available);
        if (availableSlots.length === 0) {
          console.log('No available time slots.');
        } else {
          console.log(`\nAvailable Times (${availableSlots.length} slots):`);
          console.log('Time | Available Tables | Total Capacity');
          console.log('-'.repeat(50));
          for (const slot of availableSlots) {
            console.log(`${slot.time} | ${slot.availableTables.length} tables | ${slot.totalCapacity} seats`);
          }
        }
        break;
      }

      case 'config': {
        const config = await manager.getConfig();
        console.log('\nRestaurant Configuration');
        console.log('========================');
        console.log(`Name: ${config.name}`);
        console.log(`Opening Time: ${config.openingTime}`);
        console.log(`Closing Time: ${config.closingTime}`);
        console.log(`Time Slot Interval: ${config.timeSlotInterval} min`);
        console.log(`Default Duration: ${config.defaultReservationDuration} min`);
        console.log(`Buffer Between Reservations: ${config.bufferBetweenReservations} min`);
        console.log(`SMS Confirmations: ${config.enableSmsConfirmations ? 'enabled' : 'disabled'}`);
        break;
      }

      case 'config-set': {
        if (!options.key || !options.value) {
          console.log('Error: --key and --value are required');
          console.log('\nExample: reservation-manager config-set --key restaurant.name --value "My Bistro"');
          process.exit(1);
        }
        const keyMap: Record<string, keyof Awaited<ReturnType<ReservationManager['getConfig']>>> = {
          'name': 'name',
          'openingTime': 'openingTime',
          'closingTime': 'closingTime',
          'timeSlotInterval': 'timeSlotInterval',
          'defaultReservationDuration': 'defaultReservationDuration',
          'bufferBetweenReservations': 'bufferBetweenReservations',
          'enableSmsConfirmations': 'enableSmsConfirmations',
        };
        const configKey = keyMap[options.key];
        if (!configKey) {
          console.log(`Error: Unknown key "${options.key}"`);
          console.log('Valid keys: ' + Object.keys(keyMap).join(', '));
          process.exit(1);
        }
        const update: any = {};
        update[configKey] = options.value;
        await manager.updateConfig(update);
        console.log(`Configuration updated: ${options.key} = ${options.value}`);
        break;
      }

      case 'reminders': {
        const result = await manager.sendRemindersForToday();
        console.log('\nSMS Reminders');
        console.log('=============');
        console.log(`Sent: ${result.sent} reminders`);
        if (result.reservations.length > 0) {
          console.log('\nSent to:');
          for (const r of result.reservations) {
            console.log(`  - ${r.guestName} at ${r.time}`);
          }
        }
        break;
      }

      case 'stats': {
        const stats = await manager.getStats({
          fromDate: options.from,
          toDate: options.to,
        });
        console.log('\nReservation Statistics');
        console.log('======================');
        console.log(`Total Reservations: ${stats.totalReservations}`);
        console.log(`Total Guests: ${stats.totalGuests}`);
        console.log(`Average Party Size: ${stats.averagePartySize}`);
        
        if (Object.keys(stats.byStatus).length > 0) {
          console.log('\nBy Status:');
          for (const [status, count] of Object.entries(stats.byStatus)) {
            console.log(`  ${status}: ${count}`);
          }
        }
        
        if (Object.keys(stats.bySource).length > 0) {
          console.log('\nBy Source:');
          for (const [source, count] of Object.entries(stats.bySource)) {
            console.log(`  ${source}: ${count}`);
          }
        }
        break;
      }

      default:
        await showHelp();
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await manager.close();
  }
}

main();
