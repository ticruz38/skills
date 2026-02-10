#!/usr/bin/env node

/**
 * Email Summarizer CLI
 * Summarize long email threads with key points and action items extraction
 */

import { EmailSummarizerSkill, SummaryLength, SummaryFormat } from './index';

const command = process.argv[2];
const args = process.argv.slice(3);

function getArg(name: string): string | undefined {
  const index = args.findIndex(arg => arg === `--${name}` || arg === `-${name.charAt(0)}`);
  if (index !== -1 && index < args.length - 1) {
    return args[index + 1];
  }
  const prefixed = args.find(arg => arg.startsWith(`--${name}=`));
  if (prefixed) {
    return prefixed.split('=')[1];
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`) || args.includes(`-${name.charAt(0)}`);
}

function printUsage() {
  console.log(`
Email Summarizer - Summarize long email threads

Usage:
  email-summarizer <command> [options]

Commands:
  summarize <threadId>    Summarize an email thread
  history                 Show summary history
  get <id>                Get a specific summary by ID
  thread <threadId>       Get all summaries for a thread
  stats                   Show usage statistics
  delete <id>             Delete a summary
  clear [--days N]        Clear old summaries
  health                  Check system health

Options:
  --length, -l            Summary length: short, medium, long (default: medium)
  --format, -f            Output format: paragraph, bullet, numbered (default: bullet)
  --no-actions            Don't extract action items
  --profile, -p           Email profile to use (default: default)

Examples:
  email-summarizer summarize 123abc456def
  email-summarizer summarize 123abc456def --length short --format numbered
  email-summarizer history
  email-summarizer stats
  email-summarizer health
`);
}

async function main() {
  const skill = new EmailSummarizerSkill(getArg('profile') || 'default');

  try {
    switch (command) {
      case 'summarize':
      case 's': {
        const threadId = args[0];
        if (!threadId) {
          console.error('Error: Thread ID is required');
          console.log('Usage: email-summarizer summarize <threadId> [options]');
          process.exit(1);
        }

        const length = (getArg('length') || 'medium') as SummaryLength;
        const format = (getArg('format') || 'bullet') as SummaryFormat;
        const extractActionItems = !hasFlag('no-actions');

        console.log(`Summarizing thread ${threadId}...\n`);
        
        const summary = await skill.summarize({
          threadId,
          length,
          format,
          extractActionItems,
          profile: getArg('profile') || 'default'
        });

        console.log('='.repeat(60));
        console.log(`Subject: ${summary.subject}`);
        console.log(`Messages: ${summary.messageCount} | Participants: ${summary.participants.length}`);
        console.log('='.repeat(60));
        console.log();
        console.log('📋 SUMMARY');
        console.log('-'.repeat(40));
        console.log(summary.summary);
        console.log();
        console.log('💡 KEY POINTS');
        console.log('-'.repeat(40));
        summary.keyPoints.forEach((point, i) => {
          console.log(`${i + 1}. ${point}`);
        });
        
        if (summary.actionItems.length > 0) {
          console.log();
          console.log('✅ ACTION ITEMS');
          console.log('-'.repeat(40));
          summary.actionItems.forEach((item, i) => {
            const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
            const assignee = item.assignee ? ` (@${item.assignee})` : '';
            const deadline = item.deadline ? ` [by ${item.deadline}]` : '';
            console.log(`${priority} ${item.text}${assignee}${deadline}`);
          });
        }
        
        console.log();
        console.log(`Summary saved (ID: ${summary.id})`);
        break;
      }

      case 'history':
      case 'h': {
        const history = await skill.getHistory(20);
        if (history.length === 0) {
          console.log('No summaries found.');
          break;
        }

        console.log('📜 Summary History');
        console.log('='.repeat(80));
        
        history.forEach(item => {
          const date = item.createdAt.toLocaleDateString();
          const actionCount = item.actionItems.length;
          console.log(`[${item.id}] ${date} | ${item.subject.slice(0, 40)}${item.subject.length > 40 ? '...' : ''}`);
          console.log(`    Thread: ${item.threadId.slice(0, 20)}... | Messages: ${item.messageCount} | Actions: ${actionCount}`);
          console.log();
        });
        break;
      }

      case 'get': {
        const id = parseInt(args[0]);
        if (!id) {
          console.error('Error: Summary ID is required');
          process.exit(1);
        }

        const summary = await skill.getSummary(id);
        if (!summary) {
          console.error(`Summary ${id} not found`);
          process.exit(1);
        }

        console.log('='.repeat(60));
        console.log(`Subject: ${summary.subject}`);
        console.log(`Thread: ${summary.threadId}`);
        console.log(`Messages: ${summary.messageCount} | Created: ${summary.createdAt.toLocaleString()}`);
        console.log('='.repeat(60));
        console.log();
        console.log('📋 SUMMARY');
        console.log('-'.repeat(40));
        console.log(summary.summary);
        console.log();
        console.log('💡 KEY POINTS');
        console.log('-'.repeat(40));
        summary.keyPoints.forEach((point, i) => {
          console.log(`${i + 1}. ${point}`);
        });
        
        if (summary.actionItems.length > 0) {
          console.log();
          console.log('✅ ACTION ITEMS');
          console.log('-'.repeat(40));
          summary.actionItems.forEach((item, i) => {
            const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
            const assignee = item.assignee ? ` (@${item.assignee})` : '';
            const deadline = item.deadline ? ` [by ${item.deadline}]` : '';
            console.log(`${priority} ${item.text}${assignee}${deadline}`);
          });
        }
        break;
      }

      case 'thread': {
        const threadId = args[0];
        if (!threadId) {
          console.error('Error: Thread ID is required');
          process.exit(1);
        }

        const summaries = await skill.getThreadSummaries(threadId);
        if (summaries.length === 0) {
          console.log(`No summaries found for thread ${threadId}`);
          break;
        }

        console.log(`📧 Summaries for Thread: ${threadId}`);
        console.log('='.repeat(80));
        
        summaries.forEach((summary, idx) => {
          console.log(`\n[${idx + 1}/${summaries.length}] Created: ${summary.createdAt.toLocaleString()}`);
          console.log(`Length: ${summary.length} | Format: ${summary.format}`);
          console.log('-'.repeat(60));
          console.log(summary.summary);
        });
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('📊 Email Summarizer Statistics');
        console.log('='.repeat(40));
        console.log(`Total Summaries: ${stats.totalSummaries}`);
        console.log(`Total Action Items: ${stats.totalActionItems}`);
        console.log();
        console.log('By Length:');
        Object.entries(stats.byLength).forEach(([length, count]) => {
          console.log(`  ${length}: ${count}`);
        });
        break;
      }

      case 'delete': {
        const id = parseInt(args[0]);
        if (!id) {
          console.error('Error: Summary ID is required');
          process.exit(1);
        }

        const deleted = await skill.deleteSummary(id);
        if (deleted) {
          console.log(`Summary ${id} deleted`);
        } else {
          console.error(`Summary ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'clear': {
        const days = parseInt(getArg('days') || '');
        const count = await skill.clearHistory(days || undefined);
        console.log(`Cleared ${count} summaries${days ? ` older than ${days} days` : ''}`);
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`Message: ${health.message}`);
        process.exit(health.healthy ? 0 : 1);
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        printUsage();
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
