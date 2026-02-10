#!/usr/bin/env node
/**
 * Expense Categorizer CLI
 * Auto-categorize expenses from receipts with learning from corrections
 */

import { ExpenseCategorizerSkill, Category, CategorizationResult } from './index.js';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Helper to format currency
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Helper to format percentage
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// Helper to print table
function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce((max, row) => Math.max(max, row[i]?.length || 0), 0);
    return Math.max(h.length, maxDataWidth) + 2;
  });

  // Print headers
  console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(''));
  console.log(headers.map((_, i) => '-'.repeat(colWidths[i])).join(''));
  
  // Print rows
  rows.forEach(row => {
    console.log(row.map((cell, i) => cell.padEnd(colWidths[i])).join(''));
  });
}

async function main() {
  const skill = new ExpenseCategorizerSkill();

  try {
    switch (command) {
      case 'status':
      case 'health': {
        const status = await skill.getStatus();
        const health = await skill.healthCheck();
        
        console.log('\n📊 Expense Categorizer Status\n');
        console.log(`Connected: ${health.healthy ? '✅ Yes' : '❌ No'}`);
        console.log(`Categories: ${status.categoriesCount}`);
        console.log(`Merchant Mappings: ${status.merchantMappingsCount}`);
        console.log(`\n${health.message}`);
        break;
      }

      case 'categories': {
        const categories = await skill.getCategories();
        
        console.log('\n📁 Categories\n');
        
        if (categories.length === 0) {
          console.log('No categories found.');
          break;
        }

        const headers = ['Name', 'Keywords', 'Type'];
        const rows = categories.map(c => [
          c.name,
          c.keywords.slice(0, 3).join(', ') + (c.keywords.length > 3 ? '...' : ''),
          c.isCustom ? 'Custom' : 'Default'
        ]);
        
        printTable(headers, rows);
        break;
      }

      case 'add-category': {
        const nameIndex = args.indexOf('--name');
        const keywordsIndex = args.indexOf('--keywords');
        const parentIndex = args.indexOf('--parent');
        
        const name = nameIndex > -1 ? args[nameIndex + 1] : args[1];
        const keywordsStr = keywordsIndex > -1 ? args[keywordsIndex + 1] : '';
        const parent = parentIndex > -1 ? args[parentIndex + 1] : undefined;
        
        if (!name) {
          console.error('❌ Category name is required');
          console.log('Usage: expense-categorizer add-category <name> --keywords "keyword1,keyword2"');
          process.exit(1);
        }
        
        const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()) : [];
        
        const category = await skill.addCategory({ name, keywords, parentCategory: parent });
        console.log(`✅ Created category "${category.name}"`);
        console.log(`   Keywords: ${category.keywords.join(', ')}`);
        if (parent) console.log(`   Parent: ${parent}`);
        break;
      }

      case 'delete-category': {
        const catName = args[1];
        if (!catName) {
          console.error('❌ Category name is required');
          process.exit(1);
        }
        
        await skill.deleteCategory(catName);
        console.log(`✅ Deleted category "${catName}"`);
        break;
      }

      case 'suggest': {
        const receiptId = parseInt(args[1]);
        if (isNaN(receiptId)) {
          console.error('❌ Receipt ID is required');
          process.exit(1);
        }
        
        const result = await skill.suggestCategory(receiptId);
        
        console.log('\n💡 Categorization Suggestion\n');
        console.log(`Receipt ID: ${result.receiptId}`);
        console.log(`Suggested Category: ${result.category}`);
        console.log(`Confidence: ${formatPercent(result.confidence)}`);
        console.log(`Method: ${result.method}`);
        break;
      }

      case 'categorize': {
        const receiptId = parseInt(args[1]);
        if (isNaN(receiptId)) {
          console.error('❌ Receipt ID is required');
          process.exit(1);
        }
        
        const result = await skill.categorizeReceipt(receiptId);
        
        console.log('\n📝 Categorization Result\n');
        console.log(`Receipt ID: ${result.receiptId}`);
        console.log(`Category: ${result.category}`);
        console.log(`Confidence: ${formatPercent(result.confidence)}`);
        console.log(`Method: ${result.method}`);
        console.log(`Applied: ${result.applied ? '✅ Yes' : '❌ No'}`);
        break;
      }

      case 'bulk': {
        console.log('\n🔄 Bulk Categorization\n');
        console.log('Processing uncategorized receipts...\n');
        
        const results = await skill.bulkCategorize();
        
        if (results.length === 0) {
          console.log('No receipts were categorized.');
        } else {
          console.log(`✅ Categorized ${results.length} receipts\n`);
          
          const headers = ['Receipt ID', 'Category', 'Confidence', 'Method'];
          const rows = results.map(r => [
            r.receiptId.toString(),
            r.category,
            formatPercent(r.confidence),
            r.method
          ]);
          
          printTable(headers, rows);
        }
        break;
      }

      case 'correct': {
        const receiptId = parseInt(args[1]);
        const categoryIndex = args.indexOf('--category');
        const category = categoryIndex > -1 ? args[categoryIndex + 1] : args[2];
        
        if (isNaN(receiptId) || !category) {
          console.error('❌ Receipt ID and category are required');
          console.log('Usage: expense-categorizer correct <receipt-id> --category <category>');
          process.exit(1);
        }
        
        await skill.applyCorrection(receiptId, category);
        console.log(`✅ Applied correction: Receipt ${receiptId} → "${category}"`);
        console.log('   The system has learned from this correction.');
        break;
      }

      case 'merchants': {
        const mappings = await skill.getMerchantMappings();
        
        console.log('\n🏪 Merchant Mappings\n');
        
        if (mappings.length === 0) {
          console.log('No merchant mappings found.');
          break;
        }

        const headers = ['Merchant', 'Category', 'Confidence', 'Receipts'];
        const rows = mappings.map(m => [
          m.merchant,
          m.category,
          formatPercent(m.confidence),
          m.receiptCount.toString()
        ]);
        
        printTable(headers, rows);
        break;
      }

      case 'map-merchant': {
        const merchantIndex = args.indexOf('--merchant');
        const categoryIndex = args.indexOf('--category');
        
        const merchant = merchantIndex > -1 ? args[merchantIndex + 1] : args[1];
        const category = categoryIndex > -1 ? args[categoryIndex + 1] : args[2];
        
        if (!merchant || !category) {
          console.error('❌ Merchant name and category are required');
          console.log('Usage: expense-categorizer map-merchant "<merchant>" --category <category>');
          process.exit(1);
        }
        
        await skill.mapMerchant(merchant, category);
        console.log(`✅ Mapped "${merchant}" → "${category}"`);
        break;
      }

      case 'delete-mapping': {
        const merchant = args[1];
        if (!merchant) {
          console.error('❌ Merchant name is required');
          process.exit(1);
        }
        
        await skill.deleteMerchantMapping(merchant);
        console.log(`✅ Deleted mapping for "${merchant}"`);
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        
        console.log('\n📈 Categorization Statistics\n');
        console.log(`Total Receipts: ${stats.totalReceipts}`);
        console.log(`Categorized: ${stats.categorizedReceipts} (${formatPercent(stats.categorizedReceipts / stats.totalReceipts)})`);
        console.log(`Uncategorized: ${stats.uncategorizedReceipts}`);
        console.log(`Merchant Mappings: ${stats.merchantMappings}`);
        console.log(`Corrections Applied: ${stats.corrections}`);
        
        if (stats.byCategory.length > 0) {
          console.log('\n📊 By Category:\n');
          const headers = ['Category', 'Receipts', 'Total Amount', 'Avg Confidence'];
          const rows = stats.byCategory.map(c => [
            c.category,
            c.receiptCount.toString(),
            formatCurrency(c.totalAmount),
            formatPercent(c.averageConfidence)
          ]);
          printTable(headers, rows);
        }
        break;
      }

      case 'accuracy': {
        const metrics = await skill.getAccuracyMetrics();
        
        console.log('\n🎯 Categorization Accuracy\n');
        console.log(`Total Suggestions: ${metrics.totalSuggestions}`);
        console.log(`Correct Suggestions: ${metrics.correctSuggestions}`);
        console.log(`Accuracy Rate: ${formatPercent(metrics.accuracyRate)}`);
        
        if (Object.keys(metrics.byCategory).length > 0) {
          console.log('\n📊 By Category:\n');
          const headers = ['Category', 'Correct', 'Incorrect', 'Accuracy'];
          const rows = Object.entries(metrics.byCategory).map(([cat, data]) => {
            const total = data.correct + data.incorrect;
            const acc = total > 0 ? data.correct / total : 0;
            return [
              cat,
              data.correct.toString(),
              data.incorrect.toString(),
              formatPercent(acc)
            ];
          });
          printTable(headers, rows);
        }
        break;
      }

      case 'history': {
        const limit = parseInt(args[1]) || 20;
        const history = await skill.getLearningHistory(limit);
        
        console.log(`\n📚 Learning History (last ${history.length})\n`);
        
        if (history.length === 0) {
          console.log('No corrections recorded yet.');
          break;
        }

        const headers = ['Receipt', 'Merchant', 'Suggested', 'Corrected', 'Applied'];
        const rows = history.map(h => [
          h.receiptId.toString(),
          h.merchant || '-',
          h.suggestedCategory || '-',
          h.correctedCategory,
          h.appliedAt ? new Date(h.appliedAt).toLocaleDateString() : '-'
        ]);
        
        printTable(headers, rows);
        break;
      }

      case 'help':
      default: {
        console.log(`
📂 Expense Categorizer CLI

Commands:
  status/health              Check categorizer status
  categories                 List all categories
  add-category <name>        Add a custom category
    --keywords "k1,k2"       Category keywords
    --parent <category>      Parent category
  delete-category <name>     Delete a custom category
  
  suggest <receipt-id>       Suggest category for receipt
  categorize <receipt-id>    Categorize a receipt
  bulk                       Bulk categorize all uncategorized receipts
  correct <receipt-id>       Apply correction to teach system
    --category <name>        Correct category
  
  merchants                  List merchant mappings
  map-merchant <merchant>    Map merchant to category
    --category <name>        Category name
  delete-mapping <merchant>  Delete merchant mapping
  
  stats                      Show categorization statistics
  accuracy                   Show accuracy metrics
  history [limit]            Show learning history
  help                       Show this help

Examples:
  expense-categorizer categorize 1
  expense-categorizer bulk
  expense-categorizer correct 1 --category "Office Supplies"
  expense-categorizer add-category "Travel" --keywords "flight,hotel,taxi"
`);
        break;
      }
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
