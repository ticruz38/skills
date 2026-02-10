#!/usr/bin/env node
/**
 * Email Skill CLI
 * Command-line interface for Gmail integration
 */

import { EmailSkill, SendEmailOptions } from './index';

function printUsage(): void {
  console.log(`
Email Skill CLI - Gmail integration

Usage:
  node dist/cli.js <command> [options]

Commands:
  status [profile]              Check connection status
  health [profile]              Perform health check
  list [profile] [maxResults]   List recent emails
  search [profile] <query>      Search emails with Gmail query
  read [profile] <messageId>    Read full email content
  thread [profile] <threadId>   Get thread messages
  send [profile] <to> <subject> <body>  Send email
  reply [profile] <messageId> <body>    Reply to email
  mark-read [profile] <id>      Mark email as read
  mark-unread [profile] <id>    Mark email as unread
  star [profile] <id>           Star email
  unstar [profile] <id>         Unstar email
  archive [profile] <id>        Archive email
  trash [profile] <id>          Move to trash
  delete [profile] <id>         Delete permanently
  labels [profile]              List labels

Gmail Query Examples:
  from:sender@example.com       Emails from specific sender
  to:recipient@example.com      Emails to specific recipient
  subject:meeting               Emails with subject containing "meeting"
  is:unread                     Unread emails
  is:starred                    Starred emails
  is:important                  Important emails
  has:attachment                Emails with attachments
  filename:pdf                  Emails with PDF attachments
  after:2024/01/01              Emails after date
  before:2024/12/31             Emails before date
  in:inbox                      Emails in inbox
  label:work                    Emails with specific label

Examples:
  node dist/cli.js status
  node dist/cli.js list default 10
  node dist/cli.js search default "from:boss@company.com is:unread"
  node dist/cli.js read default 123abc456
  node dist/cli.js thread default abc123thread
  node dist/cli.js send default "client@example.com" "Hello" "Meeting at 3pm"
  node dist/cli.js reply default 123abc456 "Thanks, confirmed!"
  node dist/cli.js archive default 123abc456
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  
  try {
    switch (command) {
      case 'status': {
        const profile = args[1] || 'default';
        const email = new EmailSkill({ profile });
        const status = await email.getStatus();
        
        console.log(`Profile: ${profile}`);
        console.log(`Connected: ${status.connected ? 'Yes' : 'No'}`);
        if (status.email) {
          console.log(`Email: ${status.email}`);
        }
        if (status.hasGmailScope !== undefined) {
          console.log(`Gmail Scope: ${status.hasGmailScope ? 'Authorized' : 'Not authorized'}`);
        }
        if (!status.connected) {
          console.log('\nTo connect, run: node ../google-oauth/dist/cli.js connect ' + profile);
        }
        await email.close();
        break;
      }

      case 'health': {
        const profile = args[1] || 'default';
        const email = new EmailSkill({ profile });
        const health = await email.healthCheck();
        
        console.log(`Profile: ${profile}`);
        console.log(`Status: ${health.status}`);
        if (health.email) {
          console.log(`Email: ${health.email}`);
        }
        if (health.message) {
          console.log(`Message: ${health.message}`);
        }
        await email.close();
        break;
      }

      case 'list': {
        const profile = args[1] || 'default';
        const maxResults = parseInt(args[2] || '20', 10);
        
        const email = new EmailSkill({ profile });
        const result = await email.list({ maxResults });
        
        console.log(`Found ${result.resultSizeEstimate} emails (showing ${result.emails.length}):\n`);
        
        for (const msg of result.emails) {
          const status = msg.isUnread ? '●' : '○';
          const star = msg.isStarred ? '★' : '☆';
          console.log(`${status}${star} [${msg.id}] ${msg.subject}`);
          console.log(`    From: ${msg.from}`);
          console.log(`    Date: ${msg.date}`);
          console.log(`    ${msg.snippet.substring(0, 100)}${msg.snippet.length > 100 ? '...' : ''}`);
          console.log();
        }
        
        if (result.nextPageToken) {
          console.log(`Next page token: ${result.nextPageToken}`);
        }
        await email.close();
        break;
      }

      case 'search': {
        let profile = 'default';
        let queryIndex = 1;
        
        // Check if first arg looks like a profile or query
        if (args[1] && !args[1].includes(':') && !args[1].includes('@') && args.length > 2) {
          profile = args[1];
          queryIndex = 2;
        }
        
        const query = args.slice(queryIndex).join(' ');
        if (!query) {
          console.error('Error: Query required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        const result = await email.search(query);
        
        console.log(`Query: "${query}"`);
        console.log(`Found ${result.resultSizeEstimate} emails (showing ${result.emails.length}):\n`);
        
        for (const msg of result.emails) {
          const status = msg.isUnread ? '●' : '○';
          const star = msg.isStarred ? '★' : '☆';
          console.log(`${status}${star} [${msg.id}] ${msg.subject}`);
          console.log(`    From: ${msg.from}`);
          console.log(`    Date: ${msg.date}`);
          console.log(`    ${msg.snippet.substring(0, 100)}${msg.snippet.length > 100 ? '...' : ''}`);
          console.log();
        }
        await email.close();
        break;
      }

      case 'read': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        const msg = await email.read(messageId);
        
        console.log(`ID: ${msg.id}`);
        console.log(`Thread ID: ${msg.threadId}`);
        console.log(`Subject: ${msg.subject}`);
        console.log(`From: ${msg.from}`);
        console.log(`To: ${msg.to.join(', ')}`);
        if (msg.cc.length) console.log(`Cc: ${msg.cc.join(', ')}`);
        console.log(`Date: ${msg.date}`);
        console.log(`Labels: ${msg.labelIds.join(', ')}`);
        if (msg.attachments.length) {
          console.log(`Attachments: ${msg.attachments.map(a => `${a.filename} (${a.size} bytes)`).join(', ')}`);
        }
        console.log('-'.repeat(50));
        console.log(msg.bodyText || msg.bodyHtml.replace(/<[^>]+>/g, '') || '(No content)');
        
        await email.close();
        break;
      }

      case 'thread': {
        let profile = 'default';
        let threadId: string;
        
        if (args.length === 2) {
          threadId = args[1];
        } else {
          profile = args[1];
          threadId = args[2];
        }
        
        if (!threadId) {
          console.error('Error: Thread ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        const thread = await email.getThread(threadId);
        
        console.log(`Thread ID: ${thread.id}`);
        console.log(`Messages: ${thread.messages.length}`);
        console.log('='.repeat(50));
        
        for (let i = 0; i < thread.messages.length; i++) {
          const msg = thread.messages[i];
          console.log(`\nMessage ${i + 1}/${thread.messages.length}`);
          console.log('-'.repeat(50));
          console.log(`From: ${msg.from}`);
          console.log(`To: ${msg.to.join(', ')}`);
          console.log(`Date: ${msg.date}`);
          console.log(`Subject: ${msg.subject}`);
          console.log('-'.repeat(50));
          console.log(msg.bodyText || msg.bodyHtml.replace(/<[^>]+>/g, '') || '(No content)');
        }
        
        await email.close();
        break;
      }

      case 'send': {
        let profile = 'default';
        let toIndex = 1;
        
        // Detect if first arg is profile (doesn't contain @)
        if (args[1] && !args[1].includes('@') && args.length > 3) {
          profile = args[1];
          toIndex = 2;
        }
        
        const to = args[toIndex];
        const subject = args[toIndex + 1];
        const body = args.slice(toIndex + 2).join(' ');
        
        if (!to || !subject) {
          console.error('Error: To, subject, and body required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        const result = await email.send({ to, subject, bodyText: body });
        
        console.log('Email sent successfully!');
        console.log(`Message ID: ${result.id}`);
        console.log(`Thread ID: ${result.threadId}`);
        await email.close();
        break;
      }

      case 'reply': {
        let profile = 'default';
        let messageId: string;
        let bodyIndex = 2;
        
        if (args.length >= 3 && !args[1].startsWith('1') && args[1].length < 20) {
          // First arg looks like a profile
          profile = args[1];
          messageId = args[2];
          bodyIndex = 3;
        } else {
          messageId = args[1];
        }
        
        const body = args.slice(bodyIndex).join(' ');
        
        if (!messageId || !body) {
          console.error('Error: Message ID and body required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        const result = await email.reply(messageId, { bodyText: body });
        
        console.log('Reply sent successfully!');
        console.log(`Message ID: ${result.id}`);
        console.log(`Thread ID: ${result.threadId}`);
        await email.close();
        break;
      }

      case 'mark-read':
      case 'markread': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.markAsRead(messageId, true);
        console.log('Email marked as read');
        await email.close();
        break;
      }

      case 'mark-unread':
      case 'markunread': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.markAsRead(messageId, false);
        console.log('Email marked as unread');
        await email.close();
        break;
      }

      case 'star': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.star(messageId, true);
        console.log('Email starred');
        await email.close();
        break;
      }

      case 'unstar': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.star(messageId, false);
        console.log('Email unstarred');
        await email.close();
        break;
      }

      case 'archive': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.archive(messageId);
        console.log('Email archived');
        await email.close();
        break;
      }

      case 'trash': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.trash(messageId);
        console.log('Email moved to trash');
        await email.close();
        break;
      }

      case 'delete': {
        let profile = 'default';
        let messageId: string;
        
        if (args.length === 2) {
          messageId = args[1];
        } else {
          profile = args[1];
          messageId = args[2];
        }
        
        if (!messageId) {
          console.error('Error: Message ID required');
          process.exit(1);
        }
        
        const email = new EmailSkill({ profile });
        await email.delete(messageId);
        console.log('Email deleted permanently');
        await email.close();
        break;
      }

      case 'labels': {
        const profile = args[1] || 'default';
        const email = new EmailSkill({ profile });
        const labels = await email.listLabels();
        
        console.log('Labels:');
        for (const label of labels) {
          const type = label.type === 'system' ? '[S]' : '[U]';
          console.log(`  ${type} ${label.id}: ${label.name}`);
        }
        await email.close();
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
