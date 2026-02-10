#!/usr/bin/env node
import { ShoppingListGeneratorSkill, StoreSection, ShoppingItem } from './index';

const skill = new ShoppingListGeneratorSkill();

function printUsage() {
  console.log(`
Shopping List Generator CLI

Usage: shopping-list-generator <command> [options]

Commands:
  generate <recipe-id>...    Generate list from recipe IDs
  create <name>              Create empty list
  list                       List all shopping lists
  get <id>                   Show list details
  delete <id>                Delete a list
  
  add <list-id> <name>       Add item to list
  toggle <item-id>           Toggle item checked status
  remove <item-id>           Remove item from list
  clear-checked <list-id>    Remove all checked items
  
  sections <list-id>         Show items grouped by store section
  export <list-id>           Export list to text
  
  pantry-add <name>          Add item to pantry
  pantry-remove <id>         Remove item from pantry
  pantry-list [section]      List pantry items
  pantry-search <query>      Search pantry
  pantry-check <ingredient>  Check if ingredient is in pantry
  
  stats                      Show statistics
  health                     Check system health

Options:
  --pantry-check             Check pantry when generating (default: true)
  --no-pantry-check          Skip pantry check
  --merge-duplicates         Merge duplicate items (default: true)
  --no-merge-duplicates      Don't merge duplicates
  --include-optional         Include optional ingredients
  --scale <n>                Scale recipes to N servings
  --amount <amount>          Item amount
  --section <section>        Store section
  --expires <date>           Expiration date (YYYY-MM-DD)
  --notes <notes>            Item notes
  --recipe-id <id>           Associated recipe ID
  --recipe-name <name>       Associated recipe name

Store Sections:
  produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, household, other

Examples:
  shopping-list-generator generate ita-001 mex-002 --name "Weekly Shop"
  shopping-list-generator create "Dinner Party"
  shopping-list-generator add 1 "Milk" --amount "1 gallon" --section dairy
  shopping-list-generator pantry-add "Olive Oil" --section pantry --expires 2025-12-31
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  
  try {
    switch (command) {
      case 'generate': {
        const recipeIds: string[] = [];
        let name = 'Generated List';
        const options: { pantryCheck?: boolean; mergeDuplicates?: boolean; includeOptional?: boolean; scaleServings?: number } = {
          pantryCheck: true,
          mergeDuplicates: true
        };
        
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--name') {
            name = args[++i];
          } else if (args[i] === '--pantry-check') {
            options.pantryCheck = true;
          } else if (args[i] === '--no-pantry-check') {
            options.pantryCheck = false;
          } else if (args[i] === '--merge-duplicates') {
            options.mergeDuplicates = true;
          } else if (args[i] === '--no-merge-duplicates') {
            options.mergeDuplicates = false;
          } else if (args[i] === '--include-optional') {
            options.includeOptional = true;
          } else if (args[i] === '--scale') {
            options.scaleServings = parseInt(args[++i]);
          } else if (!args[i].startsWith('--')) {
            recipeIds.push(args[i]);
          }
        }
        
        if (recipeIds.length === 0) {
          console.error('Error: No recipe IDs provided');
          process.exit(1);
        }
        
        const list = await skill.generateFromRecipeIds(recipeIds, name, options);
        console.log(`Created list: ${list.name}`);
        console.log(`ID: ${list.id}`);
        console.log(`Items: ${list.items.length}`);
        
        // Show items by section
        const bySection = await skill.getItemsBySection(list.id!);
        for (const [section, items] of Object.entries(bySection)) {
          if (items.length === 0) continue;
          console.log(`\n${section.toUpperCase()}:`);
          items.forEach(item => {
            console.log(`  [ ] ${item.name}${item.amount ? ` (${item.amount})` : ''}`);
          });
        }
        break;
      }
      
      case 'create': {
        const name = args[1];
        if (!name) {
          console.error('Error: List name required');
          process.exit(1);
        }
        
        const list = await skill.createList(name);
        console.log(`Created empty list: ${list.name}`);
        console.log(`ID: ${list.id}`);
        break;
      }
      
      case 'list': {
        const lists = await skill.listLists();
        if (lists.length === 0) {
          console.log('No shopping lists found');
        } else {
          console.log('Shopping Lists:');
          lists.forEach(l => {
            console.log(`  ${l.id}: ${l.name} (${l.itemCount} items) - ${new Date(l.createdAt).toLocaleDateString()}`);
          });
        }
        break;
      }
      
      case 'get': {
        const listId = parseInt(args[1]);
        if (isNaN(listId)) {
          console.error('Error: Valid list ID required');
          process.exit(1);
        }
        
        const list = await skill.getList(listId);
        if (!list) {
          console.error('Error: List not found');
          process.exit(1);
        }
        
        console.log(`List: ${list.name}`);
        console.log(`Created: ${new Date(list.createdAt).toLocaleDateString()}`);
        console.log(`Items: ${list.items.length}`);
        console.log('');
        
        if (list.items.length > 0) {
          const bySection = await skill.getItemsBySection(listId);
          for (const [section, items] of Object.entries(bySection)) {
            if (items.length === 0) continue;
            console.log(`[${section.toUpperCase()}]`);
            items.forEach(item => {
              const check = item.checked ? '[x]' : '[ ]';
              const recipe = item.recipeName ? ` [${item.recipeName}]` : '';
              console.log(`  ${check} ${item.name}${item.amount ? ` (${item.amount})` : ''}${recipe}`);
            });
            console.log('');
          }
        }
        break;
      }
      
      case 'delete': {
        const listId = parseInt(args[1]);
        if (isNaN(listId)) {
          console.error('Error: Valid list ID required');
          process.exit(1);
        }
        
        const success = await skill.deleteList(listId);
        if (success) {
          console.log(`Deleted list ${listId}`);
        } else {
          console.error('Error: List not found');
          process.exit(1);
        }
        break;
      }
      
      case 'add': {
        const listId = parseInt(args[1]);
        const name = args[2];
        
        if (isNaN(listId) || !name) {
          console.error('Error: List ID and item name required');
          process.exit(1);
        }
        
        const item: Omit<ShoppingItem, 'id'> = {
          name,
          amount: '',
          section: 'other',
          checked: false
        };
        
        for (let i = 3; i < args.length; i++) {
          if (args[i] === '--amount') item.amount = args[++i];
          else if (args[i] === '--section') item.section = args[++i] as StoreSection;
          else if (args[i] === '--notes') item.notes = args[++i];
          else if (args[i] === '--recipe-id') item.recipeId = args[++i];
          else if (args[i] === '--recipe-name') item.recipeName = args[++i];
        }
        
        // Auto-detect section if not specified
        if (item.section === 'other') {
          const sections: StoreSection[] = ['produce', 'meat', 'seafood', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'household'];
          const lowerName = name.toLowerCase();
          for (const section of sections) {
            const keywords: Record<string, string[]> = {
              produce: ['milk', 'egg', 'cheese', 'butter', 'yogurt'],
              meat: ['chicken', 'beef', 'pork', 'steak', 'bacon'],
              seafood: ['fish', 'salmon', 'shrimp'],
              dairy: ['milk', 'cheese', 'butter', 'yogurt'],
              bakery: ['bread', 'bun', 'bagel'],
              frozen: ['frozen', 'ice cream'],
              pantry: ['oil', 'sugar', 'flour', 'salt'],
              beverages: ['water', 'juice', 'soda', 'coffee'],
              household: ['soap', 'paper']
            };
            if (keywords[section]?.some(k => lowerName.includes(k))) {
              item.section = section;
              break;
            }
          }
        }
        
        const itemId = await skill.addItem(listId, item);
        console.log(`Added item "${name}" to list ${listId} (ID: ${itemId})`);
        break;
      }
      
      case 'toggle': {
        const itemId = parseInt(args[1]);
        if (isNaN(itemId)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }
        
        const success = await skill.toggleItem(itemId);
        if (success) {
          console.log(`Toggled item ${itemId}`);
        } else {
          console.error('Error: Item not found');
          process.exit(1);
        }
        break;
      }
      
      case 'remove':
      case 'delete-item': {
        const itemId = parseInt(args[1]);
        if (isNaN(itemId)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }
        
        const success = await skill.deleteItem(itemId);
        if (success) {
          console.log(`Removed item ${itemId}`);
        } else {
          console.error('Error: Item not found');
          process.exit(1);
        }
        break;
      }
      
      case 'clear-checked': {
        const listId = parseInt(args[1]);
        if (isNaN(listId)) {
          console.error('Error: Valid list ID required');
          process.exit(1);
        }
        
        const count = await skill.clearChecked(listId);
        console.log(`Cleared ${count} checked items from list ${listId}`);
        break;
      }
      
      case 'sections': {
        const listId = parseInt(args[1]);
        if (isNaN(listId)) {
          console.error('Error: Valid list ID required');
          process.exit(1);
        }
        
        const bySection = await skill.getItemsBySection(listId);
        
        for (const [section, items] of Object.entries(bySection)) {
          console.log(`\n[${section.toUpperCase()}] (${items.length} items)`);
          if (items.length > 0) {
            items.forEach(item => {
              const check = item.checked ? '[x]' : '[ ]';
              console.log(`  ${check} ${item.name}${item.amount ? ` (${item.amount})` : ''}`);
            });
          }
        }
        break;
      }
      
      case 'export': {
        const listId = parseInt(args[1]);
        if (isNaN(listId)) {
          console.error('Error: Valid list ID required');
          process.exit(1);
        }
        
        const text = await skill.exportToText(listId);
        if (text) {
          console.log(text);
        } else {
          console.error('Error: List not found');
          process.exit(1);
        }
        break;
      }
      
      case 'pantry-add': {
        const name = args[1];
        if (!name) {
          console.error('Error: Item name required');
          process.exit(1);
        }
        
        const item: { name: string; amount: string; section: StoreSection; expiresAt?: string; notes?: string } = {
          name,
          amount: '',
          section: 'pantry'
        };
        
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--amount') item.amount = args[++i];
          else if (args[i] === '--section') item.section = args[++i] as StoreSection;
          else if (args[i] === '--expires') item.expiresAt = args[++i];
          else if (args[i] === '--notes') item.notes = args[++i];
        }
        
        const itemId = await skill.addToPantry(item);
        console.log(`Added "${name}" to pantry (ID: ${itemId})`);
        break;
      }
      
      case 'pantry-remove':
      case 'pantry-delete': {
        const itemId = parseInt(args[1]);
        if (isNaN(itemId)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }
        
        const success = await skill.removeFromPantry(itemId);
        if (success) {
          console.log(`Removed item ${itemId} from pantry`);
        } else {
          console.error('Error: Item not found');
          process.exit(1);
        }
        break;
      }
      
      case 'pantry-list': {
        const section = args[1] as StoreSection | undefined;
        const items = await skill.listPantry(section);
        
        if (items.length === 0) {
          console.log('Pantry is empty');
        } else {
          console.log('Pantry Items:');
          const bySection: Record<string, typeof items> = {};
          items.forEach(item => {
            if (!bySection[item.section]) bySection[item.section] = [];
            bySection[item.section].push(item);
          });
          
          for (const [sec, secItems] of Object.entries(bySection)) {
            console.log(`\n[${sec.toUpperCase()}]`);
            secItems.forEach(item => {
              let line = `  ${item.name}`;
              if (item.amount) line += ` (${item.amount})`;
              if (item.expiresAt) line += ` - Expires: ${new Date(item.expiresAt).toLocaleDateString()}`;
              console.log(line);
            });
          }
        }
        break;
      }
      
      case 'pantry-search': {
        const query = args[1];
        if (!query) {
          console.error('Error: Search query required');
          process.exit(1);
        }
        
        const items = await skill.searchPantry(query);
        if (items.length === 0) {
          console.log('No items found');
        } else {
          console.log(`Found ${items.length} item(s):`);
          items.forEach(item => {
            let line = `  ${item.name}`;
            if (item.amount) line += ` (${item.amount})`;
            console.log(line);
          });
        }
        break;
      }
      
      case 'pantry-check': {
        const ingredient = args[1];
        if (!ingredient) {
          console.error('Error: Ingredient name required');
          process.exit(1);
        }
        
        const hasIt = await skill.hasInPantry(ingredient);
        console.log(hasIt 
          ? `"${ingredient}" is in your pantry`
          : `"${ingredient}" is NOT in your pantry`
        );
        break;
      }
      
      case 'stats': {
        const stats = await skill.getStats();
        console.log('Shopping List Statistics:');
        console.log(`  Lists: ${stats.listCount}`);
        console.log(`  Total items: ${stats.totalItems}`);
        console.log(`  Checked items: ${stats.checkedItems}`);
        console.log(`  Pantry items: ${stats.pantryCount}`);
        console.log(`  Expiring soon: ${stats.expiringItems}`);
        break;
      }
      
      case 'health': {
        const health = await skill.healthCheck();
        console.log(`Health: ${health.healthy ? 'OK' : 'ERROR'}`);
        console.log(health.message);
        process.exit(health.healthy ? 0 : 1);
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
