#!/usr/bin/env node

import { InboxTriageSkill, EmailCategory, EmailPriority, TriageResult } from './index';

const command = process.argv[2];
const args = process.argv.slice(3);

function formatPriority(priority: EmailPriority): string {
  const colors: Record<EmailPriority, string> = {
    critical: '\x1b[31mCRITICAL\x1b[0m',
    high: '\x1b[33mHIGH\x1b[0m',
    medium: '\x1b[36mMEDIUM\x1b[0m',
    low: '\x1b[32mLOW\x1b[0m',
    none: '\x1b[90mNONE\x1b[0m'
  };
  return colors[priority] || priority;
}

function formatCategory(category: EmailCategory): string {
  const colors: Record<EmailCategory, string> = {
    urgent: '\x1b[31mURGENT\x1b[0m',
    important: '\x1b[35mIMPORTANT\x1b[0m',
    newsletter: '\x1b[34mNEWSLETTER\x1b[0m',
    promotional: '\x1b[32mPROMO\x1b[0m',
    social: '\x1b[36mSOCIAL\x1b[0m',
    updates: '\x1b[33mUPDATES\x1b[0m',
    forums: '\x1b[90mFORUMS\x1b[0m',
    spam: '\x1b[90mSPAM\x1b[0m',
    unknown: '\x1b[90mUNKNOWN\x1b[0m'
  };
  return colors[category] || category;
}

function printEmail(result: TriageResult, index?: number) {
  const prefix = index !== undefined ? `${index + 1}. ` : '';
  console.log(`${prefix}\x1b[1m${result.email.subject}\x1b[0m`);
  console.log(`   From: ${result.email.from}`);
  console.log(`   Date: ${result.email.date.toLocaleString()}`);
  console.log(`   Category: ${formatCategory(result.classification.category)} | Priority: ${formatPriority(result.classification.priority)} | Score: ${result.classification.priorityScore.toFixed(0)}`);
  console.log(`   Confidence: ${(result.classification.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasons: ${result.classification.reasons.join(', ')}`);
  if (result.classification.actionSuggested) {
    console.log(`   Action: ${result.classification.actionSuggested}`);
  }
  console.log(`   Email ID: ${result.email.id}`);
  console.log();
}

async function main() {
  const triage = new InboxTriageSkill();

  try {
    switch (command) {
      case 'status':
      case 'health': {
        const health = await triage.healthCheck();
        console.log(`Status: ${health.status === 'healthy' ? '\x1b[32m✓ Healthy\x1b[0m' : '\x1b[31m✗ Unhealthy\x1b[0m'}`);
        if (health.message) {
          console.log(`Message: ${health.message}`);
        }
        break;
      }

      case 'classify': {
        const emailId = args[0];
        if (!emailId) {
          console.error('Usage: inbox-triage classify <email-id>');
          process.exit(1);
        }
        const classification = await triage.classify(emailId);
        console.log(`Email: ${emailId}`);
        console.log(`Category: ${formatCategory(classification.category)}`);
        console.log(`Priority: ${formatPriority(classification.priority)}`);
        console.log(`Score: ${classification.priorityScore.toFixed(0)}/100`);
        console.log(`Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
        console.log(`Reasons: ${classification.reasons.join(', ')}`);
        if (classification.actionSuggested) {
          console.log(`Suggested Action: ${classification.actionSuggested}`);
        }
        break;
      }

      case 'triage':
      case 'inbox': {
        const limit = args[0] ? parseInt(args[0]) : 20;
        console.log(`Classifying ${limit} emails from inbox...\n`);
        const results = await triage.classifyInbox(limit);
        
        if (results.length === 0) {
          console.log('No emails to classify.');
        } else {
          console.log(`\x1b[1mFound ${results.length} emails, sorted by priority:\x1b[0m\n`);
          results.forEach((result, i) => printEmail(result, i));
        }
        break;
      }

      case 'category': {
        const category = args[0] as EmailCategory;
        const limit = args[1] ? parseInt(args[1]) : 20;
        
        if (!category) {
          console.error('Usage: inbox-triage category <category> [limit]');
          console.error('Categories: urgent, important, newsletter, promotional, social, updates, forums, spam, unknown');
          process.exit(1);
        }

        const results = await triage.listByCategory(category, limit);
        console.log(`\x1b[1m${results.length} emails in category "${category}":\x1b[0m\n`);
        results.forEach((result, i) => printEmail(result, i));
        break;
      }

      case 'priority': {
        const priority = args[0] as EmailPriority;
        const limit = args[1] ? parseInt(args[1]) : 20;
        
        if (!priority) {
          console.error('Usage: inbox-triage priority <priority> [limit]');
          console.error('Priorities: critical, high, medium, low, none');
          process.exit(1);
        }

        const results = await triage.listByPriority(priority, limit);
        console.log(`\x1b[1m${results.length} emails with priority "${priority}":\x1b[0m\n`);
        results.forEach((result, i) => printEmail(result, i));
        break;
      }

      case 'unreviewed':
      case 'review': {
        const limit = args[0] ? parseInt(args[0]) : 20;
        const results = await triage.getUnreviewed(limit);
        console.log(`\x1b[1m${results.length} unreviewed emails:\x1b[0m\n`);
        results.forEach((result, i) => printEmail(result, i));
        break;
      }

      case 'mark-reviewed': {
        const emailId = args[0];
        if (!emailId) {
          console.error('Usage: inbox-triage mark-reviewed <email-id>');
          process.exit(1);
        }
        await triage.review(emailId, {});
        console.log(`Marked ${emailId} as reviewed`);
        break;
      }

      case 'set-category': {
        const emailId = args[0];
        const category = args[1] as EmailCategory;
        if (!emailId || !category) {
          console.error('Usage: inbox-triage set-category <email-id> <category>');
          console.error('Categories: urgent, important, newsletter, promotional, social, updates, forums, spam, unknown');
          process.exit(1);
        }
        await triage.review(emailId, { category });
        console.log(`Set category for ${emailId} to ${category}`);
        break;
      }

      case 'set-priority': {
        const emailId = args[0];
        const priority = args[1] as EmailPriority;
        if (!emailId || !priority) {
          console.error('Usage: inbox-triage set-priority <email-id> <priority>');
          console.error('Priorities: critical, high, medium, low, none');
          process.exit(1);
        }
        await triage.review(emailId, { priority });
        console.log(`Set priority for ${emailId} to ${priority}`);
        break;
      }

      case 'archive': {
        const emailIds = args;
        if (emailIds.length === 0) {
          console.error('Usage: inbox-triage archive <email-id> [email-id...]');
          process.exit(1);
        }
        const result = await triage.bulkArchive(emailIds);
        console.log(`Archived ${result.success.length} emails`);
        if (result.failed.length > 0) {
          console.error(`Failed to archive ${result.failed.length} emails:`);
          result.failed.forEach(f => console.error(`  ${f.emailId}: ${f.error}`));
        }
        break;
      }

      case 'mark-read': {
        const emailIds = args;
        if (emailIds.length === 0) {
          console.error('Usage: inbox-triage mark-read <email-id> [email-id...]');
          process.exit(1);
        }
        const result = await triage.bulkMarkAsRead(emailIds);
        console.log(`Marked ${result.success.length} emails as read`);
        if (result.failed.length > 0) {
          console.error(`Failed to mark ${result.failed.length} emails as read:`);
          result.failed.forEach(f => console.error(`  ${f.emailId}: ${f.error}`));
        }
        break;
      }

      case 'trash': {
        const emailIds = args;
        if (emailIds.length === 0) {
          console.error('Usage: inbox-triage trash <email-id> [email-id...]');
          process.exit(1);
        }
        const result = await triage.bulkTrash(emailIds);
        console.log(`Moved ${result.success.length} emails to trash`);
        if (result.failed.length > 0) {
          console.error(`Failed to move ${result.failed.length} emails to trash:`);
          result.failed.forEach(f => console.error(`  ${f.emailId}: ${f.error}`));
        }
        break;
      }

      case 'undo': {
        const result = await triage.undoLastAction();
        console.log(`Undid action for ${result.success.length} emails`);
        if (result.failed.length > 0) {
          console.error(`Failed to undo ${result.failed.length} actions:`);
          result.failed.forEach(f => console.error(`  ${f.emailId}: ${f.error}`));
        }
        break;
      }

      case 'add-rule': {
        const senderEmail = args[0];
        const category = args[1] as EmailCategory;
        const priority = args[2] as EmailPriority;
        
        if (!senderEmail || !category || !priority) {
          console.error('Usage: inbox-triage add-rule <sender-email> <category> <priority> [auto-action]');
          console.error('Categories: urgent, important, newsletter, promotional, social, updates, forums, spam, unknown');
          console.error('Priorities: critical, high, medium, low, none');
          process.exit(1);
        }

        const autoAction = args[3];
        await triage.addSenderRule(senderEmail, category, priority, autoAction);
        console.log(`Added rule for ${senderEmail}: ${category} / ${priority}`);
        break;
      }

      case 'rules': {
        const rules = await triage.listSenderRules();
        if (rules.length === 0) {
          console.log('No sender rules configured.');
        } else {
          console.log(`\x1b[1m${rules.length} sender rules:\x1b[0m\n`);
          rules.forEach((rule, i) => {
            console.log(`${i + 1}. ${rule.senderName || rule.senderEmail}`);
            console.log(`   Email: ${rule.senderEmail}`);
            console.log(`   Category: ${formatCategory(rule.category)} | Priority: ${formatPriority(rule.priority)}`);
            if (rule.autoAction) {
              console.log(`   Auto-action: ${rule.autoAction}`);
            }
            console.log();
          });
        }
        break;
      }

      case 'delete-rule': {
        const senderEmail = args[0];
        if (!senderEmail) {
          console.error('Usage: inbox-triage delete-rule <sender-email>');
          process.exit(1);
        }
        await triage.deleteSenderRule(senderEmail);
        console.log(`Deleted rule for ${senderEmail}`);
        break;
      }

      case 'stats': {
        const stats = await triage.getStats();
        console.log('\x1b[1mInbox Triage Statistics\x1b[0m\n');
        console.log(`Total Classified: ${stats.totalClassified}`);
        console.log(`Unreviewed: ${stats.unreviewed}`);
        console.log('\nBy Category:');
        Object.entries(stats.byCategory).forEach(([cat, count]) => {
          if (count > 0) {
            console.log(`  ${cat}: ${count}`);
          }
        });
        console.log('\nBy Priority:');
        Object.entries(stats.byPriority).forEach(([pri, count]) => {
          if (count > 0) {
            console.log(`  ${pri}: ${count}`);
          }
        });
        break;
      }

      default:
        console.log(`
Inbox Triage - AI-powered email prioritization

Usage: inbox-triage <command> [options]

Commands:
  status, health              Check system health
  classify <email-id>         Classify a specific email
  triage, inbox [limit]       Classify and triage inbox emails
  category <cat> [limit]      List emails by category
  priority <pri> [limit]      List emails by priority
  unreviewed, review [limit]  List unreviewed emails
  mark-reviewed <email-id>    Mark email as reviewed
  set-category <id> <cat>     Manually set email category
  set-priority <id> <pri>     Manually set email priority
  archive <id> [id...]        Archive emails
  mark-read <id> [id...]      Mark emails as read
  trash <id> [id...]          Move emails to trash
  undo                        Undo last bulk action
  add-rule <email> <cat> <pri> [action]  Add sender rule
  rules                       List sender rules
  delete-rule <email>         Delete sender rule
  stats                       Show statistics

Categories: urgent, important, newsletter, promotional, social, updates, forums, spam, unknown
Priorities: critical, high, medium, low, none
        `);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await triage.close();
  }
}

main();
