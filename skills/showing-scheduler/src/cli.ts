#!/usr/bin/env node
/**
 * Showing Scheduler CLI
 * Command-line interface for the showing scheduler skill
 */

import { ShowingScheduler, Showing, ShowingFeedback, OptimizedRoute } from './index';

// Parse command line arguments
function parseArgs(): { command: string; args: Record<string, string | boolean | number>; positional: string[] } {
  const args: Record<string, string | boolean | number> = {};
  const positional: string[] = [];
  let command = '';

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!command && !arg.startsWith('-')) {
      command = arg;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        // Check if it's a number
        const numValue = Number(nextArg);
        if (!isNaN(numValue) && nextArg !== '') {
          args[key] = numValue;
        } else {
          args[key] = nextArg;
        }
        i++;
      } else {
        args[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        const numValue = Number(nextArg);
        if (!isNaN(numValue) && nextArg !== '') {
          args[key] = numValue;
        } else {
          args[key] = nextArg;
        }
        i++;
      } else {
        args[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, args, positional };
}

// Format showing for display
function formatShowing(showing: Showing): string {
  const lines: string[] = [
    `ID: ${showing.id}`,
    `Client: ${showing.clientName || showing.clientId}`,
    `Property: ${showing.propertyAddress}`,
  ];

  if (showing.propertyDetails) {
    lines.push(`Details: ${showing.propertyDetails}`);
  }

  lines.push(
    `Date: ${new Date(showing.scheduledDate).toLocaleDateString()}`,
    `Time: ${showing.scheduledTime}`,
    `Duration: ${showing.duration} minutes`,
    `Status: ${showing.status.toUpperCase()}`
  );

  if (showing.lockboxCode) {
    lines.push(`Lockbox: ${showing.lockboxCode}`);
  }

  if (showing.accessNotes) {
    lines.push(`Access: ${showing.accessNotes}`);
  }

  if (showing.notes) {
    lines.push(`Notes: ${showing.notes}`);
  }

  if (showing.cancellationReason) {
    lines.push(`Cancellation Reason: ${showing.cancellationReason}`);
  }

  return lines.join('\n');
}

// Format feedback for display
function formatFeedback(feedback: ShowingFeedback): string {
  const lines: string[] = [
    `Rating: ${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)} (${feedback.rating}/5)`,
    `Interest Level: ${feedback.interestLevel.replace('_', ' ').toUpperCase()}`,
  ];

  if (feedback.priceOpinion) {
    lines.push(`Price Opinion: ${feedback.priceOpinion.replace('_', ' ').toUpperCase()}`);
  }

  if (feedback.comments) {
    lines.push(`Comments: ${feedback.comments}`);
  }

  if (feedback.pros && feedback.pros.length > 0) {
    lines.push(`Pros: ${feedback.pros.join(', ')}`);
  }

  if (feedback.cons && feedback.cons.length > 0) {
    lines.push(`Cons: ${feedback.cons.join(', ')}`);
  }

  lines.push(`Follow-up Requested: ${feedback.followUpRequested ? 'Yes' : 'No'}`);

  if (feedback.followUpNotes) {
    lines.push(`Follow-up Notes: ${feedback.followUpNotes}`);
  }

  return lines.join('\n');
}

// Format route for display
function formatRoute(route: OptimizedRoute): string {
  const lines: string[] = [
    `ROUTE OPTIMIZATION`,
    `==================`,
    `Total Distance: ${route.totalDistance} miles`,
    `Estimated Duration: ${route.estimatedDuration} minutes`,
    `Start: ${route.startAddress}`,
    `End: ${route.endAddress}`,
    ``,
    `STOPS:`,
  ];

  route.showings.forEach((showing, index) => {
    lines.push(
      `${index + 1}. ${showing.propertyAddress}`,
      `   Client: ${showing.clientName || showing.clientId}`,
      `   Time: ${showing.scheduledTime} (${showing.duration} min)`,
      `   ${showing.propertyLat && showing.propertyLng ? '' : '(no GPS coordinates)'}`
    );
    if (index < route.showings.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

// Main CLI handler
async function main() {
  const { command, args, positional } = parseArgs();
  const scheduler = new ShowingScheduler();

  try {
    switch (command) {
      case 'status': {
        const showings = await scheduler.listShowings();
        const upcoming = await scheduler.getUpcomingShowings(5);

        console.log('SHOWING SCHEDULER STATUS');
        console.log('========================');
        console.log(`Total Showings: ${showings.length}`);
        console.log(`Upcoming: ${upcoming.length}`);
        
        if (upcoming.length > 0) {
          console.log('\nNext 5 Showings:');
          upcoming.forEach(s => {
            console.log(`  ${s.scheduledDate} ${s.scheduledTime} - ${s.propertyAddress} (${s.clientName || s.clientId})`);
          });
        }
        break;
      }

      case 'health':
      case 'h': {
        const health = await scheduler.healthCheck();
        console.log('HEALTH CHECK');
        console.log('============');
        console.log(`Status: ${health.status}`);
        console.log(`Message: ${health.message}`);
        console.log(`Calendar: ${health.calendarHealthy ? '✓' : '✗'}`);
        console.log(`CRM: ${health.crmHealthy ? '✓' : '✗'}`);
        break;
      }

      case 'schedule':
      case 'add':
      case 'create': {
        const clientId = args.client as string || args.c as string;
        const address = args.address as string || args.a as string;
        const date = args.date as string || args.d as string;
        const time = args.time as string || args.t as string;
        const duration = (args.duration as number) || (args['duration'] as number) || 60;
        const lockbox = args.lockbox as string || args.l as string;
        const accessNotes = args['access-notes'] as string || args.access as string;
        const notes = args.notes as string || args.n as string;
        const details = args.details as string;
        const noCalendar = args['no-calendar'] === true;

        if (!clientId || !address || !date || !time) {
          console.error('Usage: showing-scheduler schedule --client <id> --address <address> --date <YYYY-MM-DD> --time <HH:MM>');
          process.exit(1);
        }

        const showing = await scheduler.scheduleShowing({
          clientId,
          propertyAddress: address,
          propertyDetails: details,
          scheduledDate: date,
          scheduledTime: time,
          duration,
          lockboxCode: lockbox,
          accessNotes,
          notes,
          createCalendarEvent: !noCalendar,
        });

        console.log('Showing scheduled successfully!');
        console.log('');
        console.log(formatShowing(showing));
        break;
      }

      case 'list':
      case 'ls': {
        const filter: any = {};
        
        if (args.today || args.t) {
          filter.date = new Date().toISOString().split('T')[0];
        } else if (args.date || args.d) {
          filter.date = args.date || args.d;
        }

        if (args.client || args.c) {
          filter.clientId = args.client || args.c;
        }

        if (args.status || args.s) {
          filter.status = args.status || args.s;
        }

        const showings = await scheduler.listShowings(filter);

        if (showings.length === 0) {
          console.log('No showings found.');
        } else {
          console.log(`SHOWINGS (${showings.length})`);
          console.log('=========');
          showings.forEach((s, i) => {
            console.log(`${i + 1}. ${s.scheduledDate} ${s.scheduledTime} - ${s.propertyAddress}`);
            console.log(`   Client: ${s.clientName || s.clientId} | Status: ${s.status}`);
            if (s.lockboxCode) {
              console.log(`   Lockbox: ${s.lockboxCode}`);
            }
            console.log('');
          });
        }
        break;
      }

      case 'get':
      case 'show': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler get <showing-id>');
          process.exit(1);
        }

        const showing = await scheduler.getShowing(showingId);
        if (!showing) {
          console.error(`Showing not found: ${showingId}`);
          process.exit(1);
        }

        console.log(formatShowing(showing));

        // Also show feedback if exists
        const feedback = await scheduler.getFeedback(showingId);
        if (feedback) {
          console.log('\n---\n');
          console.log('FEEDBACK:');
          console.log(formatFeedback(feedback));
        }
        break;
      }

      case 'update':
      case 'edit': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler update <showing-id> [--time HH:MM] [--date YYYY-MM-DD] [...]');
          process.exit(1);
        }

        const updates: any = {};

        if (args.time || args.t) updates.scheduledTime = args.time || args.t;
        if (args.date || args.d) updates.scheduledDate = args.date || args.d;
        if (args.duration) updates.duration = args.duration;
        if (args.address || args.a) updates.propertyAddress = args.address || args.a;
        if (args.details) updates.propertyDetails = args.details;
        if (args.notes || args.n) updates.notes = args.notes || args.n;
        if (args['access-notes'] || args.access) updates.accessNotes = args['access-notes'] || args.access;

        if (Object.keys(updates).length === 0) {
          console.error('No updates provided.');
          process.exit(1);
        }

        const showing = await scheduler.updateShowing(showingId, updates);
        console.log('Showing updated successfully!');
        console.log('');
        console.log(formatShowing(showing));
        break;
      }

      case 'cancel': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler cancel <showing-id> [--reason <reason>]');
          process.exit(1);
        }

        const reason = args.reason || args.r;
        const showing = await scheduler.cancelShowing(showingId, reason as string);
        console.log('Showing cancelled successfully!');
        console.log('');
        console.log(formatShowing(showing));
        break;
      }

      case 'complete': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler complete <showing-id>');
          process.exit(1);
        }

        const showing = await scheduler.completeShowing(showingId);
        console.log('Showing marked as completed!');
        console.log('');
        console.log(formatShowing(showing));
        break;
      }

      case 'confirm': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler confirm <showing-id>');
          process.exit(1);
        }

        const showing = await scheduler.confirmShowing(showingId);
        console.log('Showing confirmed!');
        console.log('');
        console.log(formatShowing(showing));
        break;
      }

      case 'no-show':
      case 'noshow':
      case 'missed': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler no-show <showing-id>');
          process.exit(1);
        }

        const showing = await scheduler.markNoShow(showingId);
        console.log('Showing marked as no-show.');
        console.log('');
        console.log(formatShowing(showing));
        break;
      }

      case 'lockbox':
      case 'get-lockbox': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler lockbox <showing-id>');
          process.exit(1);
        }

        const code = await scheduler.getLockboxCode(showingId);
        if (code) {
          console.log(`Lockbox Code: ${code}`);
        } else {
          console.log('No lockbox code set for this showing.');
        }
        break;
      }

      case 'set-lockbox':
      case 'lockbox-set': {
        const showingId = positional[0];
        const code = args.code as string || args.c as string;

        if (!showingId || !code) {
          console.error('Usage: showing-scheduler set-lockbox <showing-id> --code <code>');
          process.exit(1);
        }

        await scheduler.setLockboxCode(showingId, code);
        console.log(`Lockbox code set to: ${code}`);
        break;
      }

      case 'feedback':
      case 'add-feedback': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler feedback <showing-id> --rating <1-5> --interest <level> [...]');
          process.exit(1);
        }

        const rating = args.rating as number || args.r as number;
        const interest = (args.interest as string) || (args.i as string);
        const comments = args.comments as string || args.m as string;
        const followUp = args['follow-up'] === true || args.followup === true;
        const priceOpinion = args['price-opinion'] as ShowingFeedback['priceOpinion'];

        if (!rating || rating < 1 || rating > 5) {
          console.error('Rating must be between 1 and 5');
          process.exit(1);
        }

        if (!interest) {
          console.error('Interest level is required (very_high, high, medium, low, none)');
          process.exit(1);
        }

        const feedbackInput = {
          rating,
          interestLevel: interest as any,
          comments,
          followUpRequested: followUp,
          priceOpinion,
        };

        const feedback = await scheduler.addFeedback(showingId, feedbackInput);
        console.log('Feedback recorded successfully!');
        console.log('');
        console.log(formatFeedback(feedback));
        break;
      }

      case 'feedback-get':
      case 'get-feedback': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler feedback-get <showing-id>');
          process.exit(1);
        }

        const feedback = await scheduler.getFeedback(showingId);
        if (!feedback) {
          console.log('No feedback found for this showing.');
        } else {
          console.log(formatFeedback(feedback));
        }
        break;
      }

      case 'route':
      case 'optimize': {
        const date = (args.date as string) || (args.d as string) || new Date().toISOString().split('T')[0];
        const startAddress = args['start'] as string || args.s as string;

        try {
          const route = await scheduler.getRouteForDate(date, startAddress);
          console.log(formatRoute(route));
        } catch (error: any) {
          console.log(error.message);
        }
        break;
      }

      case 'upcoming': {
        const limit = (args.limit as number) || (args.n as number) || 10;
        const showings = await scheduler.getUpcomingShowings(limit);

        if (showings.length === 0) {
          console.log('No upcoming showings found.');
        } else {
          console.log(`UPCOMING SHOWINGS (${showings.length})`);
          console.log('======================');
          showings.forEach((s, i) => {
            console.log(`${i + 1}. ${s.scheduledDate} ${s.scheduledTime}`);
            console.log(`   Property: ${s.propertyAddress}`);
            console.log(`   Client: ${s.clientName || s.clientId}`);
            if (s.lockboxCode) {
              console.log(`   Lockbox: ${s.lockboxCode}`);
            }
            console.log('');
          });
        }
        break;
      }

      case 'today': {
        const showings = await scheduler.getTodayShowings();

        if (showings.length === 0) {
          console.log('No showings scheduled for today.');
        } else {
          console.log(`TODAY\u0027S SHOWINGS (${showings.length})`);
          console.log('===================');
          showings.forEach((s, i) => {
            console.log(`${i + 1}. ${s.scheduledTime} - ${s.propertyAddress}`);
            console.log(`   Client: ${s.clientName || s.clientId} | Status: ${s.status}`);
            if (s.lockboxCode) {
              console.log(`   Lockbox: ${s.lockboxCode}`);
            }
            if (s.notes) {
              console.log(`   Notes: ${s.notes}`);
            }
            console.log('');
          });
        }
        break;
      }

      case 'stats': {
        const stats = await scheduler.getStats();

        console.log('SHOWING STATISTICS');
        console.log('==================');
        console.log(`Total Showings: ${stats.totalShowings}`);
        console.log(`  Completed: ${stats.completed}`);
        console.log(`  Cancelled: ${stats.cancelled}`);
        console.log(`  No-shows: ${stats.noShow}`);
        console.log(`  Scheduled/Confirmed: ${stats.scheduled}`);
        console.log('');
        console.log(`Average Rating: ${stats.averageRating}/5`);
        console.log(`High Interest Count: ${stats.highInterestCount}`);
        
        if (stats.byMonth.length > 0) {
          console.log('\nBy Month:');
          stats.byMonth.forEach(m => {
            console.log(`  ${m.month}: ${m.count} showings`);
          });
        }
        break;
      }

      case 'delete': {
        const showingId = positional[0];
        if (!showingId) {
          console.error('Usage: showing-scheduler delete <showing-id>');
          process.exit(1);
        }

        await scheduler.deleteShowing(showingId);
        console.log(`Showing ${showingId} deleted successfully.`);
        break;
      }

      case 'help':
      default: {
        console.log('Showing Scheduler - Real estate property showing management');
        console.log('');
        console.log('USAGE:');
        console.log('  showing-scheduler <command> [options]');
        console.log('');
        console.log('COMMANDS:');
        console.log('  status                    Show scheduler status');
        console.log('  health                    Check health of dependencies');
        console.log('');
        console.log('  schedule                  Schedule a new showing');
        console.log('    --client, -c <id>       Client ID (required)');
        console.log('    --address, -a <addr>    Property address (required)');
        console.log('    --date, -d <YYYY-MM-DD> Date (required)');
        console.log('    --time, -t <HH:MM>      Time (required)');
        console.log('    --duration <min>        Duration in minutes (default: 60)');
        console.log('    --lockbox, -l <code>    Lockbox code');
        console.log('    --access-notes <notes>  Access instructions');
        console.log('    --notes, -n <notes>     General notes');
        console.log('    --details <details>     Property details');
        console.log('    --no-calendar           Skip calendar event creation');
        console.log('');
        console.log('  list, ls                  List showings');
        console.log('    --today, -t             Today\u0027s showings');
        console.log('    --date, -d <date>       Filter by date');
        console.log('    --client, -c <id>       Filter by client');
        console.log('    --status, -s <status>   Filter by status');
        console.log('');
        console.log('  get <id>                  Get showing details');
        console.log('  update <id>               Update a showing');
        console.log('    --time, -t <HH:MM>      New time');
        console.log('    --date, -d <date>       New date');
        console.log('    --duration <min>        New duration');
        console.log('    --notes <notes>         New notes');
        console.log('');
        console.log('  cancel <id>               Cancel a showing');
        console.log('    --reason, -r <reason>   Cancellation reason');
        console.log('');
        console.log('  confirm <id>              Confirm a showing');
        console.log('  complete <id>             Mark showing as completed');
        console.log('  no-show <id>              Mark as no-show');
        console.log('');
        console.log('  lockbox <id>              Get lockbox code');
        console.log('  set-lockbox <id>          Set lockbox code');
        console.log('    --code, -c <code>       Lockbox code');
        console.log('');
        console.log('  feedback <id>             Add client feedback');
        console.log('    --rating, -r <1-5>      Rating (required)');
        console.log('    --interest, -i <level>  Interest: very_high, high, medium, low, none');
        console.log('    --comments, -m <text>   Comments');
        console.log('    --follow-up             Request follow-up');
        console.log('    --price-opinion <op>    Price opinion: too_high, fair, good_value, too_low');
        console.log('');
        console.log('  feedback-get <id>         View feedback for a showing');
        console.log('');
        console.log('  route, optimize           Optimize route for date');
        console.log('    --date, -d <date>       Date (default: today)');
        console.log('    --start <address>       Starting address');
        console.log('');
        console.log('  upcoming                  List upcoming showings');
        console.log('    --limit, -n <num>       Number to show (default: 10)');
        console.log('');
        console.log('  today                     List today\u0027s showings');
        console.log('  stats                     Show statistics');
        console.log('  delete <id>               Delete a showing');
        console.log('  help                      Show this help');
        break;
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await scheduler.close();
  }
}

// Run CLI
main().catch(console.error);
