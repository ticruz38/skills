#!/usr/bin/env node
/**
 * Focus Time Blocks CLI
 * Command-line interface for managing focus time and deep work sessions
 */

import { FocusTimeSkill, FOCUS_BLOCK_TEMPLATES, FocusBlockConfig, ProductivitySession } from './index';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Helper to print usage
function printUsage() {
  console.log(`
Focus Time Blocks - Protect your calendar for deep work

Usage: focus-time-blocks <command> [options]

Commands:
  status                          Check connection status
  health                          Health check
  
  block-create <name>             Create a focus block
    --days <0,1,2...>             Days of week (0=Sun, 1=Mon...) [default: 1,2,3,4,5]
    --start <HH:MM>               Start time [default: 09:00]
    --end <HH:MM>                 End time [default: 11:00]
    --duration <minutes>          Duration in minutes
    --color <id>                  Calendar color ID
    --description <text>          Description
    --no-auto-decline             Disable auto-decline
    --no-dnd                      Disable DND mode
    
  block-list                      List all focus blocks
    --active                      Show only active blocks
    
  block-get <id>                  Get focus block details
  block-update <id>               Update focus block
  block-delete <id>               Delete focus block
  block-enable <id>               Enable focus block
  block-disable <id>              Disable focus block
  
  templates                       List focus block templates
  template-apply <name>           Apply a template
  
  schedule [days]                 Schedule focus blocks for date range
    [days]                        Number of days ahead [default: 14]
    
  sessions                        List upcoming sessions
    --today                       Show only today's sessions
    --days <n>                    Show n days ahead [default: 7]
    
  session-start <id>              Start a focus session
  session-complete <id>           Complete a focus session
    --notes <text>                Session notes
  session-interrupt <id>          Mark session as interrupted
    --count <n>                   Number of interruptions [default: 1]
  session-cancel <id>             Cancel a focus session
  
  decline-add <blockId>           Add auto-decline rule
    --pattern <text>              Meeting title pattern to match
    --organizer <email>           Meeting organizer email
    --message <text>              Decline message
    
  decline-list <blockId>          List auto-decline rules
  decline-delete <id>             Delete auto-decline rule
  
  analytics                       Show productivity analytics
    --days <n>                    Number of days [default: 30]
    
  suggest                         Get AI suggestions for focus blocks
  
  help                            Show this help message
`);
}

// Parse flags from args
function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '').replace(/-/g, '_');
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

// Main function
async function main() {
  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  const skill = new FocusTimeSkill();
  const flags = parseFlags(args.slice(1));

  try {
    switch (command) {
      case 'status': {
        const status = await skill.getStatus();
        console.log('\n📊 Focus Time Blocks Status');
        console.log('─'.repeat(40));
        console.log(`Connected: ${status.connected ? '✅' : '❌'}`);
        if (status.email) {
          console.log(`Email: ${status.email}`);
        }
        console.log(`Total Focus Blocks: ${status.focusBlocks}`);
        console.log(`Active Blocks: ${status.activeBlocks}`);
        console.log();
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log('\n🏥 Health Check');
        console.log('─'.repeat(40));
        console.log(`Status: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
        if (health.message) {
          console.log(`Message: ${health.message}`);
        }
        if (health.calendarHealth) {
          console.log(`Calendar: ${health.calendarHealth.status === 'healthy' ? '✅' : '❌'}`);
          if (health.calendarHealth.message) {
            console.log(`  └─ ${health.calendarHealth.message}`);
          }
        }
        console.log();
        break;
      }

      case 'block-create': {
        const name = args[1];
        if (!name) {
          console.error('Error: Block name required');
          process.exit(1);
        }

        const daysStr = (flags.days as string) || '1,2,3,4,5';
        const daysOfWeek = daysStr.split(',').map(d => parseInt(d.trim()));
        const startTime = (flags.start as string) || '09:00';
        const endTime = (flags.end as string) || '11:00';

        let durationMinutes = parseInt(flags.duration as string) || 0;
        if (!durationMinutes) {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);
          durationMinutes = (endHour - startHour) * 60 + (endMin - startMin);
        }

        const config: Omit<FocusBlockConfig, 'id' | 'createdAt'> = {
          name,
          durationMinutes,
          daysOfWeek,
          startTime,
          endTime,
          colorId: flags.color as string,
          description: flags.description as string,
          autoDecline: !flags.no_auto_decline,
          dndEnabled: !flags.no_dnd,
          isActive: true,
        };

        const block = await skill.createFocusBlock(config);
        console.log(`\n✅ Created focus block: ${block.name}`);
        console.log(`   ID: ${block.id}`);
        console.log(`   Days: ${block.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`);
        console.log(`   Time: ${block.startTime} - ${block.endTime}`);
        console.log(`   Auto-decline: ${block.autoDecline ? '✅' : '❌'}`);
        console.log(`   DND: ${block.dndEnabled ? '✅' : '❌'}`);
        console.log();
        break;
      }

      case 'block-list': {
        const blocks = await skill.listFocusBlocks(flags.active as boolean);
        console.log('\n📋 Focus Blocks');
        console.log('─'.repeat(60));
        if (blocks.length === 0) {
          console.log('No focus blocks found.');
        } else {
          for (const block of blocks) {
            const status = block.isActive ? '🟢' : '⚪';
            const days = block.daysOfWeek.map(d => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]).join('');
            console.log(`${status} [${block.id}] ${block.name}`);
            console.log(`   ${days} | ${block.startTime} - ${block.endTime} (${block.durationMinutes}min)`);
            console.log(`   Auto-decline: ${block.autoDecline ? '✅' : '❌'} | DND: ${block.dndEnabled ? '✅' : '❌'}`);
            if (block.description) {
              console.log(`   ${block.description}`);
            }
            console.log();
          }
        }
        break;
      }

      case 'block-get': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const block = await skill.getFocusBlock(id);
        if (!block) {
          console.error('Error: Focus block not found');
          process.exit(1);
        }

        console.log(`\n🎯 Focus Block: ${block.name}`);
        console.log('─'.repeat(40));
        console.log(`ID: ${block.id}`);
        console.log(`Status: ${block.isActive ? '🟢 Active' : '⚪ Inactive'}`);
        console.log(`Days: ${block.daysOfWeek.map(d => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')}`);
        console.log(`Time: ${block.startTime} - ${block.endTime}`);
        console.log(`Duration: ${block.durationMinutes} minutes`);
        console.log(`Auto-decline: ${block.autoDecline ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`DND Mode: ${block.dndEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        if (block.colorId) console.log(`Color ID: ${block.colorId}`);
        if (block.description) console.log(`Description: ${block.description}`);
        console.log(`Created: ${new Date(block.createdAt!).toLocaleDateString()}`);
        console.log();
        break;
      }

      case 'block-update': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const updates: Partial<Omit<FocusBlockConfig, 'id' | 'createdAt'>> = {};
        if (flags.name) updates.name = flags.name as string;
        if (flags.days) updates.daysOfWeek = (flags.days as string).split(',').map(d => parseInt(d.trim()));
        if (flags.start) updates.startTime = flags.start as string;
        if (flags.end) updates.endTime = flags.end as string;
        if (flags.duration) updates.durationMinutes = parseInt(flags.duration as string);
        if (flags.color) updates.colorId = flags.color as string;
        if (flags.description) updates.description = flags.description as string;
        if (flags.auto_decline !== undefined) updates.autoDecline = flags.auto_decline === 'true';
        if (flags.dnd !== undefined) updates.dndEnabled = flags.dnd !== 'false';

        const block = await skill.updateFocusBlock(id, updates);
        if (!block) {
          console.error('Error: Focus block not found');
          process.exit(1);
        }

        console.log(`\n✅ Updated focus block: ${block.name}`);
        console.log();
        break;
      }

      case 'block-delete': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const success = await skill.deleteFocusBlock(id);
        if (success) {
          console.log(`\n✅ Deleted focus block ${id}`);
        } else {
          console.error('Error: Focus block not found');
          process.exit(1);
        }
        console.log();
        break;
      }

      case 'block-enable': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const block = await skill.updateFocusBlock(id, { isActive: true });
        if (block) {
          console.log(`\n✅ Enabled focus block: ${block.name}`);
        } else {
          console.error('Error: Focus block not found');
          process.exit(1);
        }
        console.log();
        break;
      }

      case 'block-disable': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const block = await skill.updateFocusBlock(id, { isActive: false });
        if (block) {
          console.log(`\n✅ Disabled focus block: ${block.name}`);
        } else {
          console.error('Error: Focus block not found');
          process.exit(1);
        }
        console.log();
        break;
      }

      case 'templates': {
        console.log('\n📚 Focus Block Templates');
        console.log('─'.repeat(60));
        for (const template of FOCUS_BLOCK_TEMPLATES) {
          const days = template.daysOfWeek.map(d => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]).join('');
          console.log(`\n${template.name}`);
          console.log(`   ${days} | ${template.startTime} - ${template.endTime} (${template.durationMinutes}min)`);
          console.log(`   ${template.description}`);
        }
        console.log('\nUse: focus-time-blocks template-apply "<name>"');
        console.log();
        break;
      }

      case 'template-apply': {
        const name = args[1];
        if (!name) {
          console.error('Error: Template name required');
          process.exit(1);
        }

        const template = FOCUS_BLOCK_TEMPLATES.find(t => 
          t.name.toLowerCase() === name.toLowerCase()
        );

        if (!template) {
          console.error(`Error: Template "${name}" not found`);
          console.log('Run `focus-time-blocks templates` to see available templates');
          process.exit(1);
        }

        const block = await skill.createFocusBlock(template);
        console.log(`\n✅ Applied template: ${block.name}`);
        console.log(`   ID: ${block.id}`);
        console.log();
        break;
      }

      case 'schedule': {
        const days = parseInt(args[1]) || 14;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        console.log(`\n📅 Scheduling focus blocks for next ${days} days...`);
        const sessions = await skill.scheduleFocusBlocks(startDate, endDate);
        console.log(`✅ Scheduled ${sessions.length} sessions`);
        console.log();
        break;
      }

      case 'sessions': {
        let sessions: ProductivitySession[];
        
        if (flags.today) {
          sessions = await skill.getTodaySessions();
        } else {
          const days = parseInt(flags.days as string) || 7;
          sessions = await skill.getUpcomingSessions(days);
        }

        console.log('\n📅 Focus Sessions');
        console.log('─'.repeat(60));
        
        if (sessions.length === 0) {
          console.log('No upcoming sessions found.');
          console.log('Run `focus-time-blocks schedule` to create sessions.');
        } else {
          let currentDate = '';
          for (const session of sessions) {
            const date = new Date(session.date).toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            });
            
            if (date !== currentDate) {
              console.log(`\n${date}:`);
              currentDate = date;
            }

            const startTime = new Date(session.scheduledStart).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const endTime = new Date(session.scheduledEnd).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const statusIcons: Record<string, string> = {
              scheduled: '⏳',
              completed: '✅',
              interrupted: '⚠️',
              cancelled: '❌',
            };

            console.log(`  ${statusIcons[session.status]} [${session.id}] ${startTime} - ${endTime}`);
          }
        }
        console.log();
        break;
      }

      case 'session-start': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid session ID required');
          process.exit(1);
        }

        const session = await skill.startSession(id);
        if (!session) {
          console.error('Error: Session not found');
          process.exit(1);
        }

        console.log('\n🚀 Focus session started!');
        console.log('─'.repeat(40));
        console.log('DND mode is active. Stay focused!');
        console.log();
        break;
      }

      case 'session-complete': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid session ID required');
          process.exit(1);
        }

        const session = await skill.completeSession(id, flags.notes as string);
        if (!session) {
          console.error('Error: Session not found');
          process.exit(1);
        }

        console.log('\n🎉 Great job! Focus session completed.');
        console.log('─'.repeat(40));
        if (session.notes) {
          console.log(`Notes: ${session.notes}`);
        }
        console.log();
        break;
      }

      case 'session-interrupt': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid session ID required');
          process.exit(1);
        }

        const count = parseInt(flags.count as string) || 1;
        const session = await skill.interruptSession(id, count);
        if (!session) {
          console.error('Error: Session not found');
          process.exit(1);
        }

        console.log('\n⚠️ Session marked as interrupted.');
        console.log(`Total interruptions: ${session.interruptions}`);
        console.log();
        break;
      }

      case 'session-cancel': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid session ID required');
          process.exit(1);
        }

        const session = await skill.cancelSession(id);
        if (!session) {
          console.error('Error: Session not found');
          process.exit(1);
        }

        console.log('\n❌ Session cancelled.');
        console.log();
        break;
      }

      case 'decline-add': {
        const blockId = parseInt(args[1]);
        if (isNaN(blockId)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const rule = await skill.addAutoDeclineRule({
          focusBlockId: blockId,
          meetingTitlePattern: flags.pattern as string,
          meetingOrganizer: flags.organizer as string,
          declineMessage: (flags.message as string) || 'I am in focus time. I will respond after my deep work session.',
          isActive: true,
        });

        console.log(`\n✅ Added auto-decline rule (ID: ${rule.id})`);
        console.log();
        break;
      }

      case 'decline-list': {
        const blockId = parseInt(args[1]);
        if (isNaN(blockId)) {
          console.error('Error: Valid block ID required');
          process.exit(1);
        }

        const rules = await skill.getAutoDeclineRules(blockId);
        console.log('\n🚫 Auto-Decline Rules');
        console.log('─'.repeat(60));
        
        if (rules.length === 0) {
          console.log('No auto-decline rules found.');
        } else {
          for (const rule of rules) {
            console.log(`\n[${rule.id}]`);
            if (rule.meetingTitlePattern) {
              console.log(`   Pattern: "${rule.meetingTitlePattern}"`);
            }
            if (rule.meetingOrganizer) {
              console.log(`   Organizer: ${rule.meetingOrganizer}`);
            }
            console.log(`   Message: "${rule.declineMessage}"`);
          }
        }
        console.log();
        break;
      }

      case 'decline-delete': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid rule ID required');
          process.exit(1);
        }

        const success = await skill.deleteAutoDeclineRule(id);
        if (success) {
          console.log(`\n✅ Deleted auto-decline rule ${id}`);
        } else {
          console.error('Error: Rule not found');
          process.exit(1);
        }
        console.log();
        break;
      }

      case 'analytics': {
        const days = parseInt(flags.days as string) || 30;
        const analytics = await skill.getAnalytics(days);

        console.log(`\n📊 Productivity Analytics (Last ${days} days)`);
        console.log('─'.repeat(60));
        
        console.log('\n📈 Overview:');
        console.log(`   Total Sessions: ${analytics.totalSessions}`);
        console.log(`   Completed: ${analytics.completedSessions} (${analytics.completionRate}%)`);
        console.log(`   Interrupted: ${analytics.interruptedSessions}`);
        console.log(`   Cancelled: ${analytics.cancelledSessions}`);
        console.log(`   Total Focus Hours: ${analytics.totalFocusHours}`);
        console.log(`   Avg Session: ${analytics.averageSessionLength} min`);
        console.log(`   Interruptions/Session: ${analytics.interruptionsPerSession}`);

        if (analytics.weeklyTrend.length > 0) {
          console.log('\n📅 Weekly Trend:');
          for (const week of analytics.weeklyTrend) {
            console.log(`   ${week.week}: ${week.sessions} sessions, ${week.hours}h (${week.completionRate}% completion)`);
          }
        }

        if (analytics.dailyDistribution.length > 0) {
          console.log('\n📆 Daily Distribution:');
          for (const day of analytics.dailyDistribution) {
            console.log(`   ${day.day}: ${day.sessions} sessions (${day.hours}h)`);
          }
        }
        console.log();
        break;
      }

      case 'suggest': {
        console.log('\n🤖 AI Suggestions for Focus Blocks');
        console.log('─'.repeat(60));
        console.log('\nBased on best practices for deep work:');
        console.log();
        console.log('1. Morning Deep Work (9:00-11:00)');
        console.log('   - Your cognitive abilities are highest in the morning');
        console.log('   - 2-hour blocks allow for sustained focus');
        console.log('   - Monday-Friday for consistent routine');
        console.log();
        console.log('2. Afternoon Focus (14:00-15:30)');
        console.log('   - Post-lunch energy for analytical tasks');
        console.log('   - Shorter 90-minute block for variety');
        console.log('   - Good for meetings follow-up');
        console.log();
        console.log('3. Creative Sessions (Tuesday/Thursday 13:00-16:00)');
        console.log('   - 3-hour blocks for creative work');
        console.log('   - Mid-week when inspiration is high');
        console.log('   - Protect for writing, design, brainstorming');
        console.log();
        console.log('Tips:');
        console.log('• Enable auto-decline for external meetings during focus time');
        console.log('• Use DND mode to minimize notifications');
        console.log('• Schedule focus blocks 2-4 weeks ahead');
        console.log('• Track completion rate and adjust as needed');
        console.log();
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
