#!/usr/bin/env node

import { GiftSuggestionsSkill, Recipient, SuggestionRequest } from './index';

const skill = new GiftSuggestionsSkill();

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function printUsage() {
  console.log(`
Gift Suggestions CLI

Usage: gift-suggestions <command> [options]

Commands:
  Recipient Management:
    add-recipient <name> <relationship>    Add a new gift recipient
      --interests <list>                   Comma-separated interests
      --age <number>                       Recipient age
      --gender <gender>                    Recipient gender
      --notes <text>                       Additional notes
    
    list-recipients                        List all recipients
    get-recipient <id>                     Get recipient details
    update-recipient <id>                  Update recipient
      --name <name>
      --interests <list>
      --age <number>
      --notes <text>
    delete-recipient <id>                  Delete a recipient

  Gift Suggestions:
    suggest <recipientId>                  Get gift suggestions for recipient
      --budget <max>                       Maximum budget
      --min-budget <min>                   Minimum budget
      --occasion <occasion>                Occasion (birthday, christmas, etc.)
      --exclude-previous                   Exclude previously gifted items
      --count <n>                          Number of suggestions (default: 10)
    
    suggest-interests <interests>          Get suggestions by interests (comma-separated)
      --budget <max>
      --occasion <occasion>
      --count <n>

  Discovery:
    trending                               Show trending gift ideas
      --limit <n>                          Number to show (default: 10)
    
    categories                             List gifts by category
    
    budget <max>                           Show gifts under budget

  Gift History:
    add-history <recipientId> <gift> <occasion> <date>
      --price <amount>                     Gift price
      --notes <text>                       Notes about the gift
      --reaction <reaction>                loved, liked, neutral, disliked
    
    history [recipientId]                  View gift history

  General:
    stats                                  Show statistics
    health                                 Health check
    help                                   Show this help
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'add-recipient': {
        const name = args[1];
        const relationship = args[2];
        
        if (!name || !relationship) {
          console.error('Usage: add-recipient <name> <relationship>');
          process.exit(1);
        }

        const interestsFlag = args.findIndex(a => a === '--interests');
        const interests = interestsFlag >= 0 
          ? args[interestsFlag + 1].split(',').map(i => i.trim())
          : [];

        const ageFlag = args.findIndex(a => a === '--age');
        const age = ageFlag >= 0 ? parseInt(args[ageFlag + 1]) : undefined;

        const genderFlag = args.findIndex(a => a === '--gender');
        const gender = genderFlag >= 0 ? args[genderFlag + 1] : undefined;

        const notesFlag = args.findIndex(a => a === '--notes');
        const notes = notesFlag >= 0 ? args[notesFlag + 1] : undefined;

        const id = await skill.addRecipient({
          name,
          relationship,
          interests,
          age,
          gender,
          notes
        });

        console.log(`✓ Added recipient "${name}" with ID: ${id}`);
        break;
      }

      case 'list-recipients': {
        const recipients = await skill.listRecipients();
        
        if (recipients.length === 0) {
          console.log('No recipients found. Add one with: add-recipient <name> <relationship>');
        } else {
          console.log(`\n${recipients.length} recipient(s):\n`);
          console.log('ID  | Name              | Relationship      | Interests');
          console.log('----|-------------------|-------------------|---------------------------');
          recipients.forEach(r => {
            const interests = r.interests.slice(0, 3).join(', ') + (r.interests.length > 3 ? '...' : '');
            console.log(
              `${r.id?.toString().padEnd(3)} | ${r.name.padEnd(17)} | ${r.relationship.padEnd(17)} | ${interests}`
            );
          });
        }
        break;
      }

      case 'get-recipient': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: get-recipient <id>');
          process.exit(1);
        }

        const recipient = await skill.getRecipient(id);
        if (!recipient) {
          console.error(`Recipient ${id} not found`);
          process.exit(1);
        }

        console.log(`\nRecipient Details:\n`);
        console.log(`ID:           ${recipient.id}`);
        console.log(`Name:         ${recipient.name}`);
        console.log(`Relationship: ${recipient.relationship}`);
        console.log(`Age:          ${recipient.age || 'Not set'}`);
        console.log(`Gender:       ${recipient.gender || 'Not set'}`);
        console.log(`Interests:    ${recipient.interests.join(', ')}`);
        console.log(`Notes:        ${recipient.notes || 'None'}`);
        console.log(`Created:      ${recipient.createdAt}`);
        break;
      }

      case 'update-recipient': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: update-recipient <id> [options]');
          process.exit(1);
        }

        const updates: Partial<Recipient> = {};

        const nameFlag = args.findIndex(a => a === '--name');
        if (nameFlag >= 0) updates.name = args[nameFlag + 1];

        const interestsFlag = args.findIndex(a => a === '--interests');
        if (interestsFlag >= 0) {
          updates.interests = args[interestsFlag + 1].split(',').map(i => i.trim());
        }

        const ageFlag = args.findIndex(a => a === '--age');
        if (ageFlag >= 0) updates.age = parseInt(args[ageFlag + 1]);

        const notesFlag = args.findIndex(a => a === '--notes');
        if (notesFlag >= 0) updates.notes = args[notesFlag + 1];

        const success = await skill.updateRecipient(id, updates);
        if (success) {
          console.log(`✓ Updated recipient ${id}`);
        } else {
          console.error(`Recipient ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'delete-recipient': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Usage: delete-recipient <id>');
          process.exit(1);
        }

        const success = await skill.deleteRecipient(id);
        if (success) {
          console.log(`✓ Deleted recipient ${id}`);
        } else {
          console.error(`Recipient ${id} not found`);
          process.exit(1);
        }
        break;
      }

      case 'suggest': {
        const recipientId = parseInt(args[1]);
        if (isNaN(recipientId)) {
          console.error('Usage: suggest <recipientId> [options]');
          process.exit(1);
        }

        const budgetFlag = args.findIndex(a => a === '--budget');
        const budgetMax = budgetFlag >= 0 ? parseFloat(args[budgetFlag + 1]) : undefined;

        const minBudgetFlag = args.findIndex(a => a === '--min-budget');
        const budgetMin = minBudgetFlag >= 0 ? parseFloat(args[minBudgetFlag + 1]) : undefined;

        const occasionFlag = args.findIndex(a => a === '--occasion');
        const occasion = occasionFlag >= 0 ? args[occasionFlag + 1] : undefined;

        const excludePrevious = args.includes('--exclude-previous');

        const countFlag = args.findIndex(a => a === '--count');
        const count = countFlag >= 0 ? parseInt(args[countFlag + 1]) : 10;

        const recipient = await skill.getRecipient(recipientId);
        if (!recipient) {
          console.error(`Recipient ${recipientId} not found`);
          process.exit(1);
        }

        console.log(`\nGift suggestions for ${recipient.name}:`);
        console.log(`Interests: ${recipient.interests.join(', ')}`);
        if (budgetMax) console.log(`Budget: Up to ${formatCurrency(budgetMax)}`);
        if (occasion) console.log(`Occasion: ${occasion}`);
        console.log('');

        const results = await skill.suggestGifts({
          recipientId,
          budgetMin,
          budgetMax,
          occasion,
          excludePrevious,
          count
        });

        if (results.length === 0) {
          console.log('No suggestions found. Try adjusting your criteria.');
        } else {
          results.forEach((r, i) => {
            const s = r.suggestion;
            console.log(`${i + 1}. ${s.name}`);
            console.log(`   ${s.description}`);
            console.log(`   Price: ${formatCurrency(s.priceRange.min)} - ${formatCurrency(s.priceRange.max)} | Category: ${s.category}`);
            console.log(`   Match: ${r.matchScore} points - ${r.matchReasons.join(', ')}`);
            if (s.trending) console.log(`   🔥 Trending`);
            console.log('');
          });
        }
        break;
      }

      case 'suggest-interests': {
        const interests = args[1]?.split(',').map(i => i.trim());
        if (!interests || interests.length === 0) {
          console.error('Usage: suggest-interests <interest1,interest2,...> [options]');
          process.exit(1);
        }

        const budgetFlag = args.findIndex(a => a === '--budget');
        const budgetMax = budgetFlag >= 0 ? parseFloat(args[budgetFlag + 1]) : undefined;

        const occasionFlag = args.findIndex(a => a === '--occasion');
        const occasion = occasionFlag >= 0 ? args[occasionFlag + 1] : undefined;

        const countFlag = args.findIndex(a => a === '--count');
        const count = countFlag >= 0 ? parseInt(args[countFlag + 1]) : 10;

        console.log(`\nGift suggestions for interests: ${interests.join(', ')}`);
        if (budgetMax) console.log(`Budget: Up to ${formatCurrency(budgetMax)}`);
        if (occasion) console.log(`Occasion: ${occasion}`);
        console.log('');

        const results = await skill.suggestGifts({
          interests,
          budgetMax,
          occasion,
          count
        });

        if (results.length === 0) {
          console.log('No suggestions found. Try adjusting your criteria.');
        } else {
          results.forEach((r, i) => {
            const s = r.suggestion;
            console.log(`${i + 1}. ${s.name}`);
            console.log(`   ${s.description}`);
            console.log(`   Price: ${formatCurrency(s.priceRange.min)} - ${formatCurrency(s.priceRange.max)} | Category: ${s.category}`);
            console.log(`   Match: ${r.matchScore} points - ${r.matchReasons.join(', ')}`);
            if (s.trending) console.log(`   🔥 Trending`);
            console.log('');
          });
        }
        break;
      }

      case 'trending': {
        const limitFlag = args.findIndex(a => a === '--limit');
        const limit = limitFlag >= 0 ? parseInt(args[limitFlag + 1]) : 10;

        const trending = await skill.getTrendingGifts(limit);
        
        console.log(`\n🔥 Trending Gift Ideas:\n`);
        trending.forEach((gift, i) => {
          console.log(`${i + 1}. ${gift.name}`);
          console.log(`   ${gift.description}`);
          console.log(`   Price: ${formatCurrency(gift.priceRange.min)} - ${formatCurrency(gift.priceRange.max)} | Category: ${gift.category}`);
          console.log(`   Trending Score: ${gift.trendingScore}/100`);
          console.log('');
        });
        break;
      }

      case 'categories': {
        const categories = await skill.getGiftsByCategory();
        
        console.log(`\nGift Categories:\n`);
        Object.entries(categories).forEach(([category, gifts]) => {
          console.log(`\n${category} (${gifts.length} items):`);
          gifts.slice(0, 5).forEach(gift => {
            console.log(`  • ${gift.name} (${formatCurrency(gift.priceRange.min)}-${formatCurrency(gift.priceRange.max)})`);
          });
          if (gifts.length > 5) {
            console.log(`  ... and ${gifts.length - 5} more`);
          }
        });
        break;
      }

      case 'budget': {
        const maxBudget = parseFloat(args[1]);
        if (isNaN(maxBudget)) {
          console.error('Usage: budget <max-amount>');
          process.exit(1);
        }

        const gifts = await skill.getGiftsByBudget(maxBudget);
        
        console.log(`\nGifts under ${formatCurrency(maxBudget)}:\n`);
        
        // Group by category
        const byCategory: Record<string, typeof gifts> = {};
        gifts.forEach(g => {
          if (!byCategory[g.category]) byCategory[g.category] = [];
          byCategory[g.category].push(g);
        });

        Object.entries(byCategory).forEach(([category, catGifts]) => {
          console.log(`\n${category}:`);
          catGifts.forEach(gift => {
            console.log(`  • ${gift.name} (${formatCurrency(gift.priceRange.min)}-${formatCurrency(gift.priceRange.max)})`);
          });
        });
        break;
      }

      case 'add-history': {
        const recipientId = parseInt(args[1]);
        const giftName = args[2];
        const occasion = args[3];
        const date = args[4];

        if (isNaN(recipientId) || !giftName || !occasion || !date) {
          console.error('Usage: add-history <recipientId> <gift> <occasion> <date>');
          process.exit(1);
        }

        const priceFlag = args.findIndex(a => a === '--price');
        const price = priceFlag >= 0 ? parseFloat(args[priceFlag + 1]) : undefined;

        const notesFlag = args.findIndex(a => a === '--notes');
        const notes = notesFlag >= 0 ? args[notesFlag + 1] : undefined;

        const reactionFlag = args.findIndex(a => a === '--reaction');
        const reaction = reactionFlag >= 0 ? args[reactionFlag + 1] as any : undefined;

        const id = await skill.addGiftHistory({
          recipientId,
          giftName,
          occasion,
          date,
          price,
          notes,
          reaction
        });

        console.log(`✓ Added gift history entry with ID: ${id}`);
        break;
      }

      case 'history': {
        const recipientId = args[1] ? parseInt(args[1]) : undefined;
        const history = await skill.getGiftHistory(recipientId);

        if (history.length === 0) {
          console.log('No gift history found.');
        } else {
          console.log(`\nGift History:\n`);
          history.forEach(h => {
            const reaction = h.reaction ? ` [${h.reaction}]` : '';
            const price = h.price ? ` - ${formatCurrency(h.price)}` : '';
            console.log(`${h.date} | ${h.giftName}${price}`);
            console.log(`  For: ${h.occasion}${reaction}`);
            if (h.notes) console.log(`  Notes: ${h.notes}`);
          });
        }
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        const categories = await skill.getGiftsByCategory();
        const totalGifts = Object.values(categories).reduce((sum, gifts) => sum + gifts.length, 0);
        
        console.log(`\nGift Suggestions Statistics:\n`);
        console.log(`Total Recipients:     ${stats.totalRecipients}`);
        console.log(`Total Gifts Given:    ${stats.totalGiftsGiven}`);
        console.log(`Total Gift Value:     ${formatCurrency(stats.totalGiftValue)}`);
        console.log(`Average Gift Value:   ${formatCurrency(stats.averageGiftValue)}`);
        console.log(`\nGift Database:        ${totalGifts} curated gifts`);
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.status}`);
        console.log(`Message: ${health.message}`);
        process.exit(health.status === 'healthy' ? 0 : 1);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }

    await skill.close();
  } catch (error) {
    console.error('Error:', error);
    await skill.close();
    process.exit(1);
  }
}

main();
