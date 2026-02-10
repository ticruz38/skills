#!/usr/bin/env node
/**
 * Occasion Reminders CLI
 * Track birthdays and anniversaries with gift planning timeline
 */

import { OccasionRemindersSkill, OccasionType, AdvanceNotice } from './index';
import * as fs from 'fs';
import * as path from 'path';

const skill = new OccasionRemindersSkill();

function printUsage() {
  console.log(`
Occasion Reminders - Track birthdays and anniversaries

Usage: occasion-reminders <command> [options]

Commands:
  Status & Health:
    status, health          Show system status
    stats                   Show statistics

  Contact Management:
    add-contact <name>      Add a new contact
    list-contacts, contacts List all contacts
    get-contact <id>        Get contact details
    update-contact <id>     Update contact info
    delete-contact <id>     Delete a contact
    import <file>           Import contacts from file

  Occasion Management:
    add-occasion <contactId> <type> <name> <month> <day>
                           Add an occasion (type: birthday|anniversary|holiday|custom)
    list-occasions, occasions
                           List all occasions
    get-occasion <id>       Get occasion details
    update-occasion <id>    Update occasion
    delete-occasion <id>    Delete an occasion

  Upcoming & Planning:
    upcoming [days]         Show upcoming occasions (default: 365 days)
    birthdays               Show upcoming birthdays
    anniversaries           Show upcoming anniversaries
    timeline [days]         Show gift planning timeline (default: 90 days)

  Search:
    search <query>          Search contacts and occasions

Options:
  --email <email>          Contact email
  --phone <phone>          Contact phone
  --notes <notes>          Notes or description
  --relationship <rel>     Relationship (friend, family, colleague, etc.)
  --year <year>            Birth year or anniversary start year
  --advance-weeks <n>      Weeks of advance notice (default: 2)
  --advance-days <n>       Days of advance notice (default: 0)
  --gift-ideas <ideas>     Gift ideas/description
  --budget <amount>        Gift budget
  --format <format>        Import format (csv, json)

Examples:
  occasion-reminders add-contact "John Smith" --email john@example.com --relationship "friend"
  occasion-reminders add-occasion 1 birthday "John's Birthday" 3 15 --year 1990 --budget 50
  occasion-reminders upcoming 30
  occasion-reminders timeline 60
  occasion-reminders search "birthday"
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const remainingArgs = args.slice(1);

  // Parse options
  const options: Record<string, string> = {};
  const positionalArgs: string[] = [];
  
  for (let i = 0; i < remainingArgs.length; i++) {
    const arg = remainingArgs[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = remainingArgs[i + 1] || '';
      options[key] = value;
      i++;
    } else {
      positionalArgs.push(arg);
    }
  }

  try {
    switch (command) {
      case 'status':
      case 'health': {
        const health = await skill.healthCheck();
        console.log('\n📅 Occasion Reminders Status\n');
        console.log(`  Status: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`  Contacts: ${health.contacts}`);
        console.log(`  Occasions: ${health.occasions}`);
        console.log(`  Upcoming (30 days): ${health.upcoming}`);
        console.log(`  Database: ${health.database}`);
        if (health.error) {
          console.log(`  Error: ${health.error}`);
        }
        console.log();
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\n📊 Occasion Reminders Statistics\n');
        console.log(`  Contacts: ${stats.contacts}`);
        console.log(`  Total Occasions: ${stats.occasions}`);
        console.log(`  Birthdays: ${stats.birthdays}`);
        console.log(`  Anniversaries: ${stats.anniversaries}`);
        console.log(`  This Month: ${stats.upcomingThisMonth}`);
        console.log();
        break;
      }

      case 'add-contact': {
        const name = positionalArgs[0];
        if (!name) {
          console.error('Error: Contact name is required');
          process.exit(1);
        }
        
        const contact = await skill.addContact({
          name,
          email: options.email,
          phone: options.phone,
          notes: options.notes,
          relationship: options.relationship,
        });
        
        console.log(`\n✅ Contact added:`);
        console.log(`  ID: ${contact.id}`);
        console.log(`  Name: ${contact.name}`);
        if (contact.email) console.log(`  Email: ${contact.email}`);
        if (contact.phone) console.log(`  Phone: ${contact.phone}`);
        if (contact.relationship) console.log(`  Relationship: ${contact.relationship}`);
        console.log();
        break;
      }

      case 'list-contacts':
      case 'contacts': {
        const contacts = await skill.listContacts();
        console.log(`\n👥 Contacts (${contacts.length} total)\n`);
        
        if (contacts.length === 0) {
          console.log('  No contacts yet. Use "add-contact" to add one.\n');
        } else {
          console.log('  ID  | Name                | Relationship | Email');
          console.log('  ' + '-'.repeat(70));
          for (const contact of contacts) {
            const name = contact.name.padEnd(19);
            const rel = (contact.relationship || '-').padEnd(12);
            const email = contact.email || '-';
            console.log(`  ${contact.id.toString().padStart(3)} | ${name} | ${rel} | ${email}`);
          }
        }
        console.log();
        break;
      }

      case 'get-contact': {
        const id = parseInt(positionalArgs[0]);
        if (isNaN(id)) {
          console.error('Error: Valid contact ID is required');
          process.exit(1);
        }
        
        const contact = await skill.getContact(id);
        if (!contact) {
          console.error(`Error: Contact ${id} not found`);
          process.exit(1);
        }
        
        console.log(`\n👤 Contact Details\n`);
        console.log(`  ID: ${contact.id}`);
        console.log(`  Name: ${contact.name}`);
        console.log(`  Email: ${contact.email || '-'}`);
        console.log(`  Phone: ${contact.phone || '-'}`);
        console.log(`  Relationship: ${contact.relationship || '-'}`);
        console.log(`  Notes: ${contact.notes || '-'}`);
        console.log(`  Created: ${new Date(contact.createdAt).toLocaleDateString()}`);
        
        // Show occasions for this contact
        const occasions = await skill.getContactOccasions(id);
        if (occasions.length > 0) {
          console.log(`\n  Occasions (${occasions.length}):`);
          for (const occ of occasions) {
            console.log(`    • ${occ.name} (${occ.type}) - ${occ.month}/${occ.day}`);
          }
        }
        console.log();
        break;
      }

      case 'update-contact': {
        const id = parseInt(positionalArgs[0]);
        if (isNaN(id)) {
          console.error('Error: Valid contact ID is required');
          process.exit(1);
        }
        
        const updates: Record<string, string> = {};
        if (options.email !== undefined) updates.email = options.email;
        if (options.phone !== undefined) updates.phone = options.phone;
        if (options.notes !== undefined) updates.notes = options.notes;
        if (options.relationship !== undefined) updates.relationship = options.relationship;
        
        const contact = await skill.updateContact(id, updates);
        if (!contact) {
          console.error(`Error: Contact ${id} not found`);
          process.exit(1);
        }
        
        console.log(`\n✅ Contact updated successfully\n`);
        break;
      }

      case 'delete-contact': {
        const id = parseInt(positionalArgs[0]);
        if (isNaN(id)) {
          console.error('Error: Valid contact ID is required');
          process.exit(1);
        }
        
        const success = await skill.deleteContact(id);
        if (success) {
          console.log(`\n✅ Contact ${id} deleted\n`);
        } else {
          console.error(`Error: Contact ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'import': {
        const filePath = positionalArgs[0];
        if (!filePath) {
          console.error('Error: File path is required');
          process.exit(1);
        }
        
        const format = (options.format as 'csv' | 'json') || 'json';
        const fullPath = path.resolve(filePath);
        
        if (!fs.existsSync(fullPath)) {
          console.error(`Error: File not found: ${fullPath}`);
          process.exit(1);
        }
        
        const data = fs.readFileSync(fullPath, 'utf-8');
        const result = await skill.importContacts({ format, data });
        
        console.log(`\n📥 Import Results\n`);
        console.log(`  Imported: ${result.imported}`);
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.length}`);
          for (const error of result.errors) {
            console.log(`    • ${error}`);
          }
        }
        console.log();
        break;
      }

      case 'add-occasion': {
        const contactId = parseInt(positionalArgs[0]);
        const type = positionalArgs[1] as OccasionType;
        const name = positionalArgs[2];
        const month = parseInt(positionalArgs[3]);
        const day = parseInt(positionalArgs[4]);
        
        if (isNaN(contactId) || !type || !name || isNaN(month) || isNaN(day)) {
          console.error('Error: Usage: add-occasion <contactId> <type> <name> <month> <day>');
          console.error('       Types: birthday, anniversary, holiday, custom');
          process.exit(1);
        }
        
        const advanceNotice: AdvanceNotice = {
          weeks: parseInt(options['advance-weeks'] || '2'),
          days: parseInt(options['advance-days'] || '0'),
        };
        
        const occasion = await skill.addOccasion({
          contactId,
          type,
          name,
          month,
          day,
          year: options.year ? parseInt(options.year) : undefined,
          advanceNotice,
          giftIdeas: options['gift-ideas'],
          budget: options.budget ? parseFloat(options.budget) : undefined,
        });
        
        console.log(`\n🎉 Occasion added:`);
        console.log(`  ID: ${occasion.id}`);
        console.log(`  Name: ${occasion.name}`);
        console.log(`  Type: ${occasion.type}`);
        console.log(`  Date: ${occasion.month}/${occasion.day}`);
        console.log(`  Advance Notice: ${occasion.advanceNotice.weeks} weeks, ${occasion.advanceNotice.days} days`);
        if (occasion.budget) console.log(`  Budget: $${occasion.budget}`);
        if (occasion.giftIdeas) console.log(`  Gift Ideas: ${occasion.giftIdeas}`);
        console.log();
        break;
      }

      case 'list-occasions':
      case 'occasions': {
        const occasions = await skill.listOccasions();
        const contacts = await skill.listContacts();
        const contactMap = new Map(contacts.map(c => [c.id, c]));
        
        console.log(`\n🎊 All Occasions (${occasions.length} total)\n`);
        
        if (occasions.length === 0) {
          console.log('  No occasions yet. Use "add-occasion" to add one.\n');
        } else {
          console.log('  ID  | Contact             | Type        | Name                | Date');
          console.log('  ' + '-'.repeat(80));
          for (const occ of occasions) {
            const contact = contactMap.get(occ.contactId);
            const cName = (contact?.name || 'Unknown').padEnd(19);
            const type = occ.type.padEnd(11);
            const oName = occ.name.padEnd(19);
            console.log(`  ${occ.id.toString().padStart(3)} | ${cName} | ${type} | ${oName} | ${occ.month}/${occ.day}`);
          }
        }
        console.log();
        break;
      }

      case 'get-occasion': {
        const id = parseInt(positionalArgs[0]);
        if (isNaN(id)) {
          console.error('Error: Valid occasion ID is required');
          process.exit(1);
        }
        
        const occasion = await skill.getOccasion(id);
        if (!occasion) {
          console.error(`Error: Occasion ${id} not found`);
          process.exit(1);
        }
        
        const contact = await skill.getContact(occasion.contactId);
        
        console.log(`\n🎊 Occasion Details\n`);
        console.log(`  ID: ${occasion.id}`);
        console.log(`  Name: ${occasion.name}`);
        console.log(`  Type: ${occasion.type}`);
        console.log(`  Contact: ${contact?.name || 'Unknown'} (ID: ${occasion.contactId})`);
        console.log(`  Date: ${occasion.month}/${occasion.day}`);
        if (occasion.year) console.log(`  Year: ${occasion.year}`);
        console.log(`  Advance Notice: ${occasion.advanceNotice.weeks} weeks, ${occasion.advanceNotice.days} days`);
        if (occasion.budget) console.log(`  Budget: $${occasion.budget}`);
        if (occasion.giftIdeas) console.log(`  Gift Ideas: ${occasion.giftIdeas}`);
        console.log();
        break;
      }

      case 'update-occasion': {
        const id = parseInt(positionalArgs[0]);
        if (isNaN(id)) {
          console.error('Error: Valid occasion ID is required');
          process.exit(1);
        }
        
        const updates: Record<string, any> = {};
        if (options.name !== undefined) updates.name = options.name;
        if (options.year !== undefined) updates.year = parseInt(options.year);
        if (options['gift-ideas'] !== undefined) updates.giftIdeas = options['gift-ideas'];
        if (options.budget !== undefined) updates.budget = parseFloat(options.budget);
        
        if (options['advance-weeks'] !== undefined || options['advance-days'] !== undefined) {
          updates.advanceNotice = {
            weeks: parseInt(options['advance-weeks'] || '2'),
            days: parseInt(options['advance-days'] || '0'),
          };
        }
        
        const occasion = await skill.updateOccasion(id, updates);
        if (!occasion) {
          console.error(`Error: Occasion ${id} not found`);
          process.exit(1);
        }
        
        console.log(`\n✅ Occasion updated successfully\n`);
        break;
      }

      case 'delete-occasion': {
        const id = parseInt(positionalArgs[0]);
        if (isNaN(id)) {
          console.error('Error: Valid occasion ID is required');
          process.exit(1);
        }
        
        const success = await skill.deleteOccasion(id);
        if (success) {
          console.log(`\n✅ Occasion ${id} deleted\n`);
        } else {
          console.error(`Error: Occasion ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'upcoming': {
        const days = parseInt(positionalArgs[0] || '365');
        const upcoming = await skill.getUpcomingOccasions(days);
        
        console.log(`\n📅 Upcoming Occasions (next ${days} days)\n`);
        
        if (upcoming.length === 0) {
          console.log('  No upcoming occasions.\n');
        } else {
          for (const occ of upcoming) {
            const age = occ.age ? ` (turning ${occ.age})` : '';
            const years = occ.yearsTogether ? ` (${occ.yearsTogether} years)` : '';
            const notice = occ.isAdvanceNotice ? ' ⚠️ GIFT PLANNING' : '';
            
            console.log(`  🎉 ${occ.name} - ${occ.contactName}${age}${years}`);
            console.log(`     Date: ${occ.nextDate.toLocaleDateString()} (${occ.daysUntil} days)${notice}`);
            if (occ.budget) console.log(`     Budget: $${occ.budget}`);
            if (occ.giftIdeas) console.log(`     Ideas: ${occ.giftIdeas}`);
            console.log();
          }
        }
        break;
      }

      case 'birthdays': {
        const birthdays = await skill.getOccasionsByType('birthday');
        const contacts = await skill.listContacts();
        const contactMap = new Map(contacts.map(c => [c.id, c]));
        
        console.log(`\n🎂 Birthdays (${birthdays.length} total)\n`);
        
        if (birthdays.length === 0) {
          console.log('  No birthdays tracked yet.\n');
        } else {
          // Calculate upcoming dates
          const now = new Date();
          const currentYear = now.getFullYear();
          
          const withDates = birthdays.map(b => {
            const nextDate = new Date(currentYear, b.month - 1, b.day);
            if (nextDate < now) {
              nextDate.setFullYear(currentYear + 1);
            }
            return { ...b, nextDate, daysUntil: Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) };
          }).sort((a, b) => a.daysUntil - b.daysUntil);
          
          for (const b of withDates) {
            const contact = contactMap.get(b.contactId);
            const age = b.year ? ` (turning ${b.nextDate.getFullYear() - b.year})` : '';
            console.log(`  ${b.month}/${b.day} - ${contact?.name || 'Unknown'}${age} (${b.daysUntil} days)`);
          }
        }
        console.log();
        break;
      }

      case 'anniversaries': {
        const anniversaries = await skill.getOccasionsByType('anniversary');
        const contacts = await skill.listContacts();
        const contactMap = new Map(contacts.map(c => [c.id, c]));
        
        console.log(`\n💕 Anniversaries (${anniversaries.length} total)\n`);
        
        if (anniversaries.length === 0) {
          console.log('  No anniversaries tracked yet.\n');
        } else {
          const now = new Date();
          const currentYear = now.getFullYear();
          
          const withDates = anniversaries.map(a => {
            const nextDate = new Date(currentYear, a.month - 1, a.day);
            if (nextDate < now) {
              nextDate.setFullYear(currentYear + 1);
            }
            return { ...a, nextDate, daysUntil: Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) };
          }).sort((a, b) => a.daysUntil - b.daysUntil);
          
          for (const a of withDates) {
            const contact = contactMap.get(a.contactId);
            const years = a.year ? ` (${currentYear - a.year} years)` : '';
            console.log(`  ${a.month}/${a.day} - ${a.name} for ${contact?.name || 'Unknown'}${years} (${a.daysUntil} days)`);
          }
        }
        console.log();
        break;
      }

      case 'timeline': {
        const days = parseInt(positionalArgs[0] || '90');
        const timeline = await skill.getGiftPlanningTimeline(days);
        
        console.log(`\n🎁 Gift Planning Timeline (next ${days} days)\n`);
        
        if (timeline.length === 0) {
          console.log('  No gift planning needed right now.\n');
        } else {
          for (const item of timeline) {
            const occ = item.occasion;
            const age = occ.age ? ` (turning ${occ.age})` : '';
            const years = occ.yearsTogether ? ` (${occ.yearsTogether} years)` : '';
            
            console.log(`  🎉 ${occ.name} - ${occ.contactName}${age}${years}`);
            console.log(`     Date: ${occ.nextDate.toLocaleDateString()} (${occ.daysUntil} days away)`);
            if (occ.budget) console.log(`     Budget: $${occ.budget}`);
            console.log(`     Timeline:`);
            console.log(`       • Start shopping: ${item.timeline.startShopping.toLocaleDateString()}`);
            console.log(`       • Order by: ${item.timeline.orderBy.toLocaleDateString()}`);
            console.log(`       • Wrap by: ${item.timeline.wrapBy.toLocaleDateString()}`);
            console.log(`       • Give on: ${item.timeline.giveOn.toLocaleDateString()}`);
            console.log(`     Actions:`);
            for (const action of item.suggestedActions) {
              console.log(`       • ${action}`);
            }
            console.log();
          }
        }
        break;
      }

      case 'search': {
        const query = positionalArgs.join(' ');
        if (!query) {
          console.error('Error: Search query is required');
          process.exit(1);
        }
        
        const results = await skill.search(query);
        
        console.log(`\n🔍 Search Results for "${query}"\n`);
        
        console.log(`  Contacts (${results.contacts.length}):`);
        if (results.contacts.length === 0) {
          console.log('    No matching contacts');
        } else {
          for (const c of results.contacts) {
            console.log(`    • ${c.name}${c.relationship ? ` (${c.relationship})` : ''}`);
          }
        }
        
        console.log(`\n  Occasions (${results.occasions.length}):`);
        if (results.occasions.length === 0) {
          console.log('    No matching occasions');
        } else {
          for (const o of results.occasions) {
            console.log(`    • ${o.name} (${o.type}) - ${o.month}/${o.day}`);
          }
        }
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
