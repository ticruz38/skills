#!/usr/bin/env node
/**
 * Tax Preparation Skill CLI
 * Command-line interface for tax document compilation
 */

import { TaxPrepSkill, IRSExpenseCategory, getTaxPrepSkill } from './index';

const VALID_CATEGORIES: IRSExpenseCategory[] = [
  'Advertising',
  'Car and Truck Expenses',
  'Commissions and Fees',
  'Contract Labor',
  'Depletion',
  'Depreciation',
  'Employee Benefit Programs',
  'Insurance',
  'Interest',
  'Legal and Professional Services',
  'Office Expense',
  'Pension and Profit Sharing Plans',
  'Rent or Lease - Vehicles',
  'Rent or Lease - Equipment',
  'Rent or Lease - Other',
  'Repairs and Maintenance',
  'Supplies',
  'Taxes and Licenses',
  'Travel',
  'Meals',
  'Utilities',
  'Wages',
  'Other Expenses',
];

function printUsage(): void {
  console.log(`
Tax Preparation Skill CLI

Usage: tax-prep <command> [options]

Commands:
  status                          Check skill and dependency status
  categorize [options]            Categorize expenses using IRS categories
    Options:
      --year <year>               Categorize expenses for specific year
      --start-date <date>         Start date (YYYY-MM-DD)
      --end-date <date>           End date (YYYY-MM-DD)
  
  deductions [options]            View deductible expenses
    Options:
      --year <year>               Filter by year
      --category <category>       Filter by IRS category
      --export <path>             Export to CSV file
  
  schedule-c [options]            Generate Schedule C report
    Options:
      --year <year>               Tax year (required)
      --export <path>             Export to HTML file
  
  contractors [options]           List 1099 contractors
    Options:
      --year <year>               Filter by year
      --name <name>               Search specific contractor
      --export <path>             Export to CSV file
  
  turbotax [options]              Export for TurboTax
    Options:
      --year <year>               Tax year (required)
      --output <path>             Output file path
  
  package [options]               Generate complete accountant package
    Options:
      --year <year>               Tax year (required)
      --output <dir>              Output directory
  
  summary [options]               Get tax year summary
    Options:
      --year <year>               Tax year (required)
  
  add-mapping <keyword> <category> [priority]
                                  Add custom category mapping
  
  help                            Show this help message

Examples:
  tax-prep status
  tax-prep categorize --year 2024
  tax-prep deductions --year 2024 --export deductions.csv
  tax-prep schedule-c --year 2024 --export schedule-c.html
  tax-prep contractors --year 2024
  tax-prep turbotax --year 2024 --output turbotax.csv
  tax-prep package --year 2024 --output ./tax-package
  tax-prep add-mapping "aws" "Office Expense" 100
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed[`_${i}`] = arg;
    }
  }
  
  return parsed;
}

async function showStatus(skill: TaxPrepSkill): Promise<void> {
  const health = await skill.healthCheck();
  
  console.log('\n📊 Tax Preparation Skill Status\n');
  console.log(`Overall: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
  console.log(`Message: ${health.message}\n`);
  
  console.log('Dependencies:');
  for (const [name, status] of Object.entries(health.dependencies)) {
    const icon = status.status === 'healthy' ? '✅' : '❌';
    console.log(`  ${icon} ${name}: ${status.status}`);
    if (status.message) {
      console.log(`     ${status.message}`);
    }
  }
  console.log();
}

async function categorizeExpenses(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  const options: { year?: number; startDate?: string; endDate?: string } = {};
  
  if (args.year) {
    options.year = parseInt(args.year as string, 10);
  }
  if (args['start-date']) {
    options.startDate = args['start-date'] as string;
  }
  if (args['end-date']) {
    options.endDate = args['end-date'] as string;
  }

  console.log('\n📁 Categorizing expenses...\n');
  
  const result = await skill.categorizeExpenses(options);
  
  console.log(`✅ Categorized ${result.categorized} of ${result.total} expenses`);
  console.log();
}

async function showDeductions(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  const options: { year?: number; category?: IRSExpenseCategory } = {};
  
  if (args.year) {
    options.year = parseInt(args.year as string, 10);
  }
  if (args.category && VALID_CATEGORIES.includes(args.category as IRSExpenseCategory)) {
    options.category = args.category as IRSExpenseCategory;
  }

  console.log('\n💰 Deductible Expenses\n');
  
  const result = await skill.getDeductions(options);
  
  console.log('By Category:');
  console.log('-'.repeat(70));
  
  const sortedCategories = Object.entries(result.byCategory)
    .sort(([, a], [, b]) => b.deductibleAmount - a.deductibleAmount);
  
  for (const [category, data] of sortedCategories) {
    console.log(`${category.padEnd(35)} ${data.count.toString().padStart(4)} items  $${data.deductibleAmount.toFixed(2).padStart(12)}`);
  }
  
  console.log('-'.repeat(70));
  console.log(`${'TOTAL DEDUCTIONS'.padEnd(35)} ${result.totalDeductible.toFixed(2).padStart(12)}`);
  console.log();

  // Export if requested
  if (args.export) {
    const lines = ['Category,Count,Amount,Deductible Amount'];
    for (const [cat, data] of Object.entries(result.byCategory)) {
      lines.push(`${cat},${data.count},${data.amount.toFixed(2)},${data.deductibleAmount.toFixed(2)}`);
    }
    lines.push(`TOTAL,0,0,${result.totalDeductible.toFixed(2)}`);
    
    const fs = await import('fs');
    fs.writeFileSync(args.export as string, lines.join('\n'));
    console.log(`✅ Exported to ${args.export}\n`);
  }
}

async function generateScheduleC(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  if (!args.year) {
    console.error('Error: --year is required');
    process.exit(1);
  }

  const year = parseInt(args.year as string, 10);
  
  console.log(`\n📋 Generating Schedule C for ${year}...\n`);
  
  const report = await skill.generateScheduleC(year);
  
  console.log('INCOME:');
  console.log(`  Gross Receipts:        $${report.grossReceipts.toFixed(2)}`);
  console.log(`  Gross Profit:          $${report.grossProfit.toFixed(2)}`);
  console.log(`  Gross Income:          $${report.grossIncome.toFixed(2)}`);
  console.log();
  
  console.log('EXPENSES:');
  const sortedExpenses = Object.entries(report.expenses)
    .sort(([, a], [, b]) => b - a)
    .filter(([, amount]) => amount > 0);
  
  for (const [category, amount] of sortedExpenses) {
    console.log(`  ${category.padEnd(30)} $${amount.toFixed(2)}`);
  }
  console.log(`  ${'TOTAL EXPENSES'.padEnd(30)} $${report.totalExpenses.toFixed(2)}`);
  console.log();
  
  const profitLabel = report.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS';
  console.log(`${profitLabel}: $${Math.abs(report.netProfit).toFixed(2)}`);
  console.log();

  // Export if requested
  if (args.export) {
    const fs = await import('fs');
    const html = skill['generateScheduleCHTML'](report);
    fs.writeFileSync(args.export as string, html);
    console.log(`✅ Exported to ${args.export}\n`);
  }
}

async function listContractors(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  const options: { year?: number } = {};
  
  if (args.year) {
    options.year = parseInt(args.year as string, 10);
  }

  console.log('\n👷 1099 Contractors\n');
  
  const contractors = await skill.get1099Contractors(options);
  
  if (contractors.length === 0) {
    console.log('No contractors found.\n');
    return;
  }

  // Filter by name if specified
  let filtered = contractors;
  if (args.name) {
    const searchName = (args.name as string).toLowerCase();
    filtered = contractors.filter(c => c.name.toLowerCase().includes(searchName));
  }

  console.log('Name                              Total Paid    1099 Required');
  console.log('-'.repeat(70));
  
  for (const c of filtered) {
    const requires1099 = c.requires1099 ? '✅ Yes' : '❌ No';
    console.log(`${c.name.padEnd(32)} $${c.totalPaid.toFixed(2).padStart(10)}    ${requires1099}`);
  }
  
  const total1099s = filtered.filter(c => c.requires1099).length;
  console.log('-'.repeat(70));
  console.log(`Total contractors: ${filtered.length} | Requires 1099: ${total1099s}`);
  console.log();

  // Export if requested
  if (args.export) {
    const lines = ['Name,Total Paid,Requires 1099'];
    for (const c of filtered) {
      lines.push(`${c.name},${c.totalPaid.toFixed(2)},${c.requires1099 ? 'Yes' : 'No'}`);
    }
    
    const fs = await import('fs');
    fs.writeFileSync(args.export as string, lines.join('\n'));
    console.log(`✅ Exported to ${args.export}\n`);
  }
}

async function exportTurboTax(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  if (!args.year) {
    console.error('Error: --year is required');
    process.exit(1);
  }

  const year = parseInt(args.year as string, 10);
  const outputPath = (args.output as string) || `turbotax-${year}.csv`;
  
  console.log(`\n📤 Exporting for TurboTax (${year})...\n`);
  
  const { csv, rows } = await skill.exportForTurboTax(year);
  
  const fs = await import('fs');
  fs.writeFileSync(outputPath, csv);
  
  console.log(`✅ Exported ${rows.length} transactions to ${outputPath}`);
  console.log(`   Income items: ${rows.filter(r => r.amount > 0).length}`);
  console.log(`   Expense items: ${rows.filter(r => r.amount < 0).length}`);
  console.log();
}

async function generatePackage(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  if (!args.year) {
    console.error('Error: --year is required');
    process.exit(1);
  }

  const year = parseInt(args.year as string, 10);
  const outputDir = (args.output as string) || `./tax-package-${year}`;
  
  console.log(`\n📦 Generating accountant package for ${year}...\n`);
  
  const { package: pkg, files } = await skill.generateAccountantPackage(year, outputDir);
  
  console.log('Package generated:\n');
  console.log(`  Year: ${pkg.year}`);
  console.log(`  Total Income: $${pkg.incomeSummary.totalRevenue.toFixed(2)}`);
  console.log(`  Total Expenses: $${pkg.expenseSummary.totalExpenses.toFixed(2)}`);
  console.log(`  Net Profit: $${pkg.scheduleC.netProfit.toFixed(2)}`);
  console.log(`  Receipts: ${pkg.receiptCount}`);
  console.log(`  Invoices: ${pkg.invoiceCount}`);
  console.log(`  1099 Contractors: ${pkg.contractors1099.filter(c => c.requires1099).length}`);
  console.log();
  console.log('Files created:');
  for (const file of files) {
    console.log(`  📄 ${file}`);
  }
  console.log();
}

async function showSummary(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  if (!args.year) {
    console.error('Error: --year is required');
    process.exit(1);
  }

  const year = parseInt(args.year as string, 10);
  
  console.log(`\n📊 Tax Year Summary for ${year}\n`);
  
  const summary = await skill.getTaxYearSummary(year);
  
  console.log('INCOME & EXPENSES:');
  console.log(`  Total Income:          $${summary.totalIncome.toFixed(2)}`);
  console.log(`  Total Expenses:        $${summary.totalExpenses.toFixed(2)}`);
  console.log(`  Net Profit:            $${summary.netProfit.toFixed(2)}`);
  console.log();
  
  console.log('DEDUCTIONS:');
  console.log(`  Total Deductions:      $${summary.totalDeductions.toFixed(2)}`);
  console.log();
  
  console.log('ESTIMATED TAX:');
  console.log(`  Estimated Tax Due:     $${summary.estimatedTaxDue.toFixed(2)}`);
  console.log();
  
  console.log('TOP EXPENSE CATEGORIES:');
  const sortedCats = Object.entries(summary.expenseBreakdown)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 5);
  
  for (const [cat, data] of sortedCats) {
    console.log(`  ${cat.padEnd(30)} $${data.amount.toFixed(2)} (${data.count} items)`);
  }
  console.log();
}

async function addMapping(skill: TaxPrepSkill, args: Record<string, string | boolean>): Promise<void> {
  const keyword = args._1 as string;
  const category = args._2 as IRSExpenseCategory;
  const priority = args._3 ? parseInt(args._3 as string, 10) : 100;
  
  if (!keyword || !category) {
    console.error('Error: keyword and category are required');
    console.log('Usage: tax-prep add-mapping <keyword> <category> [priority]');
    process.exit(1);
  }

  if (!VALID_CATEGORIES.includes(category)) {
    console.error(`Error: Invalid category "${category}"`);
    console.log('Valid categories:');
    for (const cat of VALID_CATEGORIES) {
      console.log(`  - ${cat}`);
    }
    process.exit(1);
  }

  await skill.addCategoryMapping(keyword, category, priority);
  
  console.log(`\n✅ Added mapping: "${keyword}" → "${category}" (priority: ${priority})\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const parsedArgs = parseArgs(args.slice(1));
  
  const skill = getTaxPrepSkill();
  
  try {
    switch (command) {
      case 'status':
        await showStatus(skill);
        break;
      case 'categorize':
        await categorizeExpenses(skill, parsedArgs);
        break;
      case 'deductions':
        await showDeductions(skill, parsedArgs);
        break;
      case 'schedule-c':
        await generateScheduleC(skill, parsedArgs);
        break;
      case 'contractors':
        await listContractors(skill, parsedArgs);
        break;
      case 'turbotax':
        await exportTurboTax(skill, parsedArgs);
        break;
      case 'package':
        await generatePackage(skill, parsedArgs);
        break;
      case 'summary':
        await showSummary(skill, parsedArgs);
        break;
      case 'add-mapping':
        await addMapping(skill, parsedArgs);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
