#!/usr/bin/env node
/**
 * Pantry Tracker CLI
 * Command-line interface for pantry inventory management
 */

import { PantryTrackerSkill, PantryCategory, AddPantryItemOptions } from './index';

const args = process.argv.slice(2);
const command = args[0];

// Helper to format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

// Helper to format number
function formatNumber(num: number): string {
  return num.toFixed(2).replace(/\.00$/, '');
}

// Helper to get status emoji
function getStatusEmoji(item: { quantity: number; lowStockThreshold: number; expirationDate: string | null }): string {
  const isLowStock = item.quantity <= item.lowStockThreshold;
  
  if (item.expirationDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiration = new Date(item.expirationDate);
    const daysUntil = Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return '🔴'; // Expired
    if (daysUntil <= 3) return '⚠️';  // Expiring soon
  }
  
  if (isLowStock) return '⚡'; // Low stock
  
  return '✓';
}

async function main() {
  const skill = new PantryTrackerSkill();

  try {
    switch (command) {
      case 'health':
      case 'status': {
        const health = await skill.healthCheck();
        console.log('\n📦 Pantry Tracker Status');
        console.log('========================');
        console.log(`Status: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`Database: ${health.database}`);
        console.log(`Total Items: ${health.totalItems}`);
        console.log(`Low Stock: ${health.lowStockItems}`);
        console.log(`Expiring Soon: ${health.expiringItems}`);
        console.log(`Expired: ${health.expiredItems}`);
        if (health.error) {
          console.log(`Error: ${health.error}`);
        }
        break;
      }

      case 'add':
      case 'a': {
        const name = args[1];
        if (!name) {
          console.error('Error: Item name required');
          console.log('Usage: pantry-tracker add <name> [options]');
          process.exit(1);
        }

        const options: AddPantryItemOptions = {
          name,
          quantity: 1,
          unit: 'item',
          category: 'other',
          lowStockThreshold: 1
        };

        // Parse arguments
        for (let i = 2; i < args.length; i++) {
          const arg = args[i];
          switch (arg) {
            case '--barcode':
            case '-b':
              options.barcode = args[++i];
              break;
            case '--quantity':
            case '-q':
              options.quantity = parseFloat(args[++i]);
              break;
            case '--unit':
            case '-u':
              options.unit = args[++i];
              break;
            case '--category':
            case '-c':
              options.category = args[++i] as PantryCategory;
              break;
            case '--expires':
            case '-e':
              options.expirationDate = args[++i];
              break;
            case '--threshold':
            case '-t':
              options.lowStockThreshold = parseFloat(args[++i]);
              break;
            case '--notes':
            case '-n':
              options.notes = args[++i];
              break;
          }
        }

        const item = await skill.addItem(options);
        console.log(`\n✅ Added: ${item.name}`);
        console.log(`   Quantity: ${formatNumber(item.quantity)} ${item.unit}`);
        console.log(`   Category: ${item.category}`);
        if (item.expirationDate) {
          console.log(`   Expires: ${formatDate(item.expirationDate)}`);
        }
        if (item.barcode) {
          console.log(`   Barcode: ${item.barcode}`);
        }
        break;
      }

      case 'scan': {
        const barcode = args[1];
        if (!barcode) {
          console.error('Error: Barcode required');
          console.log('Usage: pantry-tracker scan <barcode> [name] [options]');
          process.exit(1);
        }

        // Check if item already exists
        const existing = await skill.getItemByBarcode(barcode);
        if (existing) {
          console.log(`\n📱 Found existing item: ${existing.name}`);
          const restocked = await skill.restockItem(existing.id, 1);
          console.log(`✅ Restocked. New quantity: ${formatNumber(restocked.quantity)} ${restocked.unit}`);
          break;
        }

        const name = args[2];
        if (!name) {
          console.log(`\n📱 Barcode: ${barcode}`);
          console.log('Item not found. Add with: pantry-tracker scan <barcode> <name> [options]');
          process.exit(1);
        }

        const options: AddPantryItemOptions = {
          barcode,
          name,
          quantity: 1,
          unit: 'item',
          category: 'other',
          lowStockThreshold: 1
        };

        // Parse remaining arguments
        for (let i = 3; i < args.length; i++) {
          const arg = args[i];
          switch (arg) {
            case '--quantity':
            case '-q':
              options.quantity = parseFloat(args[++i]);
              break;
            case '--unit':
            case '-u':
              options.unit = args[++i];
              break;
            case '--category':
            case '-c':
              options.category = args[++i] as PantryCategory;
              break;
            case '--expires':
            case '-e':
              options.expirationDate = args[++i];
              break;
          }
        }

        const item = await skill.addItem(options);
        console.log(`\n✅ Scanned and added: ${item.name}`);
        console.log(`   Barcode: ${item.barcode}`);
        console.log(`   Quantity: ${formatNumber(item.quantity)} ${item.unit}`);
        break;
      }

      case 'list':
      case 'ls': {
        const options: { category?: PantryCategory; search?: string; lowStockOnly?: boolean; limit?: number } = {};
        
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          switch (arg) {
            case '--category':
            case '-c':
              options.category = args[++i] as PantryCategory;
              break;
            case '--search':
            case '-s':
              options.search = args[++i];
              break;
            case '--low-stock':
            case '-l':
              options.lowStockOnly = true;
              break;
            case '--limit':
              options.limit = parseInt(args[++i]);
              break;
          }
        }

        const { items, total } = await skill.listItems(options);
        
        if (items.length === 0) {
          console.log('\n📭 No items found');
          break;
        }

        console.log(`\n📦 Pantry Items (${items.length} of ${total})`);
        console.log('=====================================');
        console.log('Status │ ID │ Name                │ Quantity      │ Category   │ Expires');
        console.log('───────┼────┼─────────────────────┼───────────────┼────────────┼──────────');
        
        for (const item of items) {
          const status = getStatusEmoji(item);
          const name = item.name.length > 19 ? item.name.substring(0, 18) + '…' : item.name.padEnd(19);
          const qty = `${formatNumber(item.quantity)} ${item.unit}`.padEnd(13);
          const cat = item.category.padEnd(10);
          const exp = item.expirationDate ? formatDate(item.expirationDate).padEnd(10) : 'N/A';
          
          console.log(` ${status}    │ ${String(item.id).padEnd(2)} │ ${name} │ ${qty} │ ${cat} │ ${exp}`);
        }
        break;
      }

      case 'get':
      case 'show': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }

        const item = await skill.getItem(id);
        console.log(`\n📦 Item Details`);
        console.log('===============');
        console.log(`ID: ${item.id}`);
        console.log(`Name: ${item.name}`);
        if (item.barcode) console.log(`Barcode: ${item.barcode}`);
        console.log(`Quantity: ${formatNumber(item.quantity)} ${item.unit}`);
        console.log(`Category: ${item.category}`);
        console.log(`Low Stock Threshold: ${item.lowStockThreshold}`);
        if (item.expirationDate) {
          const exp = new Date(item.expirationDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntil < 0) {
            console.log(`Expires: ${formatDate(item.expirationDate)} ⚠️ EXPIRED`);
          } else if (daysUntil <= 3) {
            console.log(`Expires: ${formatDate(item.expirationDate)} ⚠️ Expires in ${daysUntil} days`);
          } else {
            console.log(`Expires: ${formatDate(item.expirationDate)} (${daysUntil} days)`);
          }
        }
        if (item.notes) console.log(`Notes: ${item.notes}`);
        console.log(`Created: ${formatDate(item.createdAt)}`);
        console.log(`Updated: ${formatDate(item.updatedAt)}`);
        break;
      }

      case 'update': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }

        const updates: { name?: string; quantity?: number; unit?: string; category?: PantryCategory; expirationDate?: string | null; lowStockThreshold?: number; notes?: string } = {};

        for (let i = 2; i < args.length; i++) {
          const arg = args[i];
          switch (arg) {
            case '--name':
            case '-n':
              updates.name = args[++i];
              break;
            case '--quantity':
            case '-q':
              updates.quantity = parseFloat(args[++i]);
              break;
            case '--unit':
            case '-u':
              updates.unit = args[++i];
              break;
            case '--category':
            case '-c':
              updates.category = args[++i] as PantryCategory;
              break;
            case '--expires':
            case '-e':
              updates.expirationDate = args[++i];
              break;
            case '--no-expires':
              updates.expirationDate = null;
              break;
            case '--threshold':
            case '-t':
              updates.lowStockThreshold = parseFloat(args[++i]);
              break;
            case '--notes':
              updates.notes = args[++i];
              break;
          }
        }

        const item = await skill.updateItem(id, updates);
        console.log(`\n✅ Updated: ${item.name}`);
        break;
      }

      case 'consume':
      case 'use': {
        const id = parseInt(args[1]);
        const amount = parseFloat(args[2]) || 1;
        
        if (isNaN(id)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }

        const item = await skill.consumeItem(id, amount);
        console.log(`\n✅ Consumed ${amount} ${item.unit} of ${item.name}`);
        console.log(`   Remaining: ${formatNumber(item.quantity)} ${item.unit}`);
        
        if (item.quantity <= item.lowStockThreshold) {
          console.log(`   ⚡ Low stock alert!`);
        }
        break;
      }

      case 'restock':
      case 'add-stock': {
        const id = parseInt(args[1]);
        const amount = parseFloat(args[2]) || 1;
        
        if (isNaN(id)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }

        const item = await skill.restockItem(id, amount);
        console.log(`\n✅ Restocked ${amount} ${item.unit} of ${item.name}`);
        console.log(`   New quantity: ${formatNumber(item.quantity)} ${item.unit}`);
        break;
      }

      case 'delete':
      case 'remove':
      case 'rm': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Valid item ID required');
          process.exit(1);
        }

        await skill.deleteItem(id);
        console.log(`\n✅ Deleted item #${id}`);
        break;
      }

      case 'search':
      case 'find': {
        const query = args[1];
        if (!query) {
          console.error('Error: Search query required');
          process.exit(1);
        }

        const items = await skill.searchItems(query);
        
        if (items.length === 0) {
          console.log('\n📭 No items found');
          break;
        }

        console.log(`\n🔍 Search Results (${items.length})`);
        console.log('=====================================');
        
        for (const item of items) {
          const status = getStatusEmoji(item);
          console.log(`${status} #${item.id}: ${item.name} - ${formatNumber(item.quantity)} ${item.unit} (${item.category})`);
        }
        break;
      }

      case 'alerts':
      case 'low-stock': {
        const alerts = await skill.getLowStockAlerts();
        
        if (alerts.length === 0) {
          console.log('\n✅ No low stock alerts');
          break;
        }

        console.log(`\n⚡ Low Stock Alerts (${alerts.length})`);
        console.log('=====================================');
        
        for (const alert of alerts) {
          console.log(`#${alert.item.id}: ${alert.item.name}`);
          console.log(`   Current: ${formatNumber(alert.currentQuantity)} ${alert.item.unit}`);
          console.log(`   Threshold: ${alert.threshold} ${alert.item.unit}`);
          console.log();
        }
        break;
      }

      case 'expiring': {
        const days = parseInt(args[1]) || 7;
        const alerts = await skill.getExpirationAlerts(days);
        
        if (alerts.length === 0) {
          console.log(`\n✅ No items expiring within ${days} days`);
          break;
        }

        console.log(`\n📅 Expiration Alerts (${alerts.length})`);
        console.log('=====================================');
        
        for (const alert of alerts) {
          const icon = alert.status === 'expired' ? '🔴' : alert.status === 'expiring_soon' ? '⚠️' : '⚡';
          const daysText = alert.daysUntilExpiry < 0 
            ? `Expired ${Math.abs(alert.daysUntilExpiry)} days ago` 
            : `Expires in ${alert.daysUntilExpiry} days`;
          
          console.log(`${icon} #${alert.item.id}: ${alert.item.name}`);
          console.log(`   ${daysText} (${formatDate(alert.item.expirationDate)})`);
          console.log();
        }
        break;
      }

      case 'shopping-list':
      case 'list-needed': {
        const items = await skill.generateShoppingList();
        
        if (items.length === 0) {
          console.log('\n✅ Nothing needed - pantry is stocked!');
          break;
        }

        console.log(`\n🛒 Shopping List (${items.length} items)`);
        console.log('=====================================');
        
        let currentCategory = '';
        for (const item of items) {
          if (item.category !== currentCategory) {
            currentCategory = item.category;
            console.log(`\n${currentCategory.toUpperCase()}:`);
          }
          
          const reason = item.reason === 'low_stock' ? ' (low stock)' : ' (expired)';
          console.log(`  ☐ ${item.name}: ${formatNumber(item.quantity)} ${item.unit}${reason}`);
        }
        break;
      }

      case 'categories': {
        const categories = skill.getCategories();
        console.log('\n📂 Available Categories');
        console.log('=======================');
        
        for (const category of categories) {
          console.log(`  • ${category}`);
        }
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\n📊 Pantry Statistics');
        console.log('====================');
        console.log(`Total Items: ${stats.totalItems}`);
        console.log(`Categories: ${stats.totalCategories}`);
        console.log(`Low Stock Items: ${stats.lowStockCount}`);
        console.log(`Expiring Soon: ${stats.expiringSoonCount}`);
        console.log(`Expired Items: ${stats.expiredCount}`);
        
        if (Object.keys(stats.itemsByCategory).length > 0) {
          console.log('\nItems by Category:');
          for (const [category, count] of Object.entries(stats.itemsByCategory)) {
            console.log(`  ${category}: ${count}`);
          }
        }
        break;
      }

      case 'clear-expired': {
        const count = await skill.clearExpired();
        console.log(`\n🗑️ Cleared ${count} expired items from pantry`);
        break;
      }

      case 'help':
      default: {
        console.log(`
📦 Pantry Tracker CLI

USAGE:
  pantry-tracker <command> [options]

COMMANDS:
  health, status              Check system status
  add, a <name>               Add a new item
    --barcode, -b <code>      Barcode for the item
    --quantity, -q <num>      Quantity (default: 1)
    --unit, -u <unit>         Unit (default: item)
    --category, -c <cat>      Category (default: other)
    --expires, -e <date>      Expiration date (YYYY-MM-DD)
    --threshold, -t <num>     Low stock threshold (default: 1)
    --notes, -n <text>        Notes
  
  scan <barcode> [name]       Scan barcode (auto-restock if exists)
  
  list, ls                    List all items
    --category, -c <cat>      Filter by category
    --search, -s <query>      Search by name
    --low-stock, -l           Show only low stock items
    --limit <n>               Limit results
  
  get, show <id>              Show item details
  update <id> [options]       Update item
  consume, use <id> [amount]  Consume quantity (default: 1)
  restock <id> [amount]       Add quantity (default: 1)
  delete, rm <id>             Delete an item
  search, find <query>        Search items
  
  alerts, low-stock           Show low stock alerts
  expiring [days]             Show expiring items (default: 7 days)
  shopping-list               Generate shopping list
  
  categories                  List available categories
  stats                       Show pantry statistics
  clear-expired               Remove all expired items
  help                        Show this help message

EXAMPLES:
  pantry-tracker add "Milk" -q 2 -u gallon -c dairy -e 2026-02-15 -t 1
  pantry-tracker scan 123456789 "Organic Eggs" -q 12 -u count -c dairy
  pantry-tracker list --category produce
  pantry-tracker consume 5 0.5
  pantry-tracker expiring 3
`);
        break;
      }
    }

    console.log(); // Empty line at end
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
