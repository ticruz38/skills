#!/usr/bin/env node
/**
 * Buffer Time Skill CLI
 */

import { BufferTimeSkill } from './index';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Buffer Time Skill - Auto-add buffers between meetings

Usage: buffer-time <command> [options]

Commands:
  status                          Check system status
  config                          Show current configuration
  set-default <minutes>           Set default buffer minutes
  rules                           List buffer rules
  add-rule <name> <keyword> <buffer> [prep]  Add a buffer rule
  delete-rule <id>                Delete a buffer rule
  analyze [date] [--days=N]       Analyze calendar for missing buffers
  schedule                        Interactive schedule with buffer
  stats                           Show statistics
  health                          Health check
  help                            Show this help

Examples:
  buffer-time set-default 15
  buffer-time add-rule "Client Calls" "client" 30 15
  buffer-time analyze 2024-01-15 --days=7
`);
}

async function main() {
  const skill = new BufferTimeSkill();

  try {
    switch (command) {
      case 'status':
      case 'health': {
        const health = await skill.healthCheck();
        console.log(`\nStatus: ${health.status.toUpperCase()}`);
        console.log(`Message: ${health.message}`);
        if (health.calendarStatus) {
          console.log(`\nCalendar:`);
          console.log(`  Connected: ${health.calendarStatus.status}`);
          if (health.calendarStatus.email) {
            console.log(`  Email: ${health.calendarStatus.email}`);
          }
        }
        break;
      }

      case 'config': {
        const config = await skill.getConfig();
        console.log('\nBuffer Time Configuration:');
        console.log('==========================');
        console.log(`Default Buffer: ${config.defaultBufferMinutes} minutes`);
        console.log(`Travel Time Enabled: ${config.travelTimeEnabled ? 'Yes' : 'No'}`);
        console.log(`Default Travel Time: ${config.defaultTravelMinutes} minutes`);
        console.log(`Prep Time Enabled: ${config.prepTimeEnabled ? 'Yes' : 'No'}`);
        console.log(`Skip Buffer (Same Location): ${config.sameLocationNoBuffer ? 'Yes' : 'No'}`);
        console.log(`Min Meeting Duration for Buffer: ${config.minMeetingDurationForBuffer} minutes`);
        break;
      }

      case 'set-default': {
        const minutes = parseInt(args[1]);
        if (isNaN(minutes) || minutes < 0) {
          console.error('Error: Please provide a valid number of minutes');
          process.exit(1);
        }
        await skill.setDefaultBuffer(minutes);
        console.log(`✓ Default buffer set to ${minutes} minutes`);
        break;
      }

      case 'rules': {
        const rules = await skill.getBufferRules();
        console.log('\nBuffer Rules:');
        console.log('=============');
        if (rules.length === 0) {
          console.log('No rules configured');
        } else {
          console.table(rules.map(r => ({
            ID: r.id,
            Name: r.name,
            Keyword: r.keyword,
            'Buffer (min)': r.bufferMinutes,
            'Prep (min)': r.prepMinutes,
            Enabled: r.enabled ? 'Yes' : 'No',
          })));
        }
        break;
      }

      case 'add-rule': {
        const name = args[1];
        const keyword = args[2];
        const buffer = parseInt(args[3]);
        const prep = parseInt(args[4]) || 0;

        if (!name || !keyword || isNaN(buffer)) {
          console.error('Usage: buffer-time add-rule <name> <keyword> <buffer_minutes> [prep_minutes]');
          process.exit(1);
        }

        const rule = await skill.addBufferRule({
          name,
          keyword,
          bufferMinutes: buffer,
          prepMinutes: prep,
          enabled: true,
        });

        console.log(`✓ Added rule: ${rule.name}`);
        console.log(`  Keyword: "${rule.keyword}"`);
        console.log(`  Buffer: ${rule.bufferMinutes} min, Prep: ${rule.prepMinutes} min`);
        break;
      }

      case 'delete-rule': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Please provide a valid rule ID');
          process.exit(1);
        }
        await skill.deleteBufferRule(id);
        console.log(`✓ Deleted rule ${id}`);
        break;
      }

      case 'analyze': {
        const dateArg = args[1];
        const daysArg = args.find(a => a.startsWith('--days='));
        const days = daysArg ? parseInt(daysArg.split('=')[1]) : 1;
        
        const date = dateArg && !dateArg.startsWith('--') ? dateArg : undefined;
        
        console.log('\nAnalyzing calendar for buffer gaps...');
        console.log(`Date: ${date || new Date().toISOString().split('T')[0]}`);
        console.log(`Days: ${days}`);
        console.log('');

        try {
          const gaps = await skill.findMissingBuffers({ date, days });
          
          if (gaps.length === 0) {
            console.log('No consecutive meetings found to analyze.');
          } else {
            const needsBuffer = gaps.filter(g => g.needsBuffer);
            
            console.log(`Found ${gaps.length} meeting transitions`);
            console.log(`${needsBuffer.length} need additional buffer time`);
            console.log('');

            if (needsBuffer.length > 0) {
              console.log('Meetings needing buffers:');
              console.log('=========================');
              needsBuffer.forEach(gap => {
                console.log(`\n"${gap.previousEvent.summary}" → "${gap.nextEvent.summary}"`);
                console.log(`  Gap: ${gap.gapMinutes} minutes`);
                console.log(`  Recommended: ${gap.recommendedBuffer} minutes`);
                console.log(`  Missing: ${gap.recommendedBuffer - gap.gapMinutes} minutes`);
              });
            }

            console.log('\nAll transitions:');
            console.table(gaps.map(g => ({
              'From': g.previousEvent.summary.substring(0, 30),
              'To': g.nextEvent.summary.substring(0, 30),
              'Gap (min)': g.gapMinutes,
              'Needed (min)': g.recommendedBuffer,
              'Status': g.needsBuffer ? '⚠️ SHORT' : '✓ OK',
            })));
          }
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : String(error));
        }
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\nBuffer Time Statistics:');
        console.log('=======================');
        console.log(`Total Buffers Created: ${stats.totalBuffers}`);
        console.log(`Auto-Created: ${stats.autoCreated}`);
        console.log(`\nBy Type:`);
        console.log(`  Travel: ${stats.byType.travel}`);
        console.log(`  Preparation: ${stats.byType.prep}`);
        console.log(`  Decompression: ${stats.byType.decompression}`);
        console.log(`\nBuffer Rules: ${stats.rulesCount}`);
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        printHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
