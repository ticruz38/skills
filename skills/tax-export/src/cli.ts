#!/usr/bin/env node
/**
 * Tax Export CLI
 * Command-line interface for the tax export skill
 */

import { TaxExportSkill, ExportOptions } from './index';
import * as fs from 'fs';
import * as path from 'path';

// CLI argument parsing
function parseArgs(): { command: string; args: Record<string, string | boolean | number> } {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const parsed: Record<string, string | boolean | number> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '');
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        // Handle numeric values
        if (!isNaN(Number(nextArg))) {
          parsed[key] = Number(nextArg);
        } else {
          parsed[key] = nextArg;
        }
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return { command, args: parsed };
}

// Format currency
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

// Main CLI handler
async function main(): Promise<void> {
  const { command, args } = parseArgs();
  const skill = new TaxExportSkill();

  try {
    switch (command) {
      case 'status': {
        const status = await skill.getStatus();
        console.log('\n📊 Tax Export Status');
        console.log('=' .repeat(40));
        console.log(`Connected:        ${status.connected ? '✓' : '✗'}`);
        console.log(`IRS Categories:   ${status.irsCategoriesCount}`);
        console.log(`Category Mappings: ${status.mappingsCount}`);
        console.log(`Total Exports:    ${status.totalExports}`);
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log('\n🏥 Tax Export Health');
        console.log('=' .repeat(40));
        console.log(`Healthy: ${health.healthy ? '✓' : '✗'}`);
        console.log(`Message: ${health.message}`);
        console.log('\nDetails:');
        console.log(`  Database:         ${health.details.database ? '✓' : '✗'}`);
        console.log(`  Expense Categorizer: ${health.details.expenseCategorizer ? '✓' : '✗'}`);
        console.log(`  Receipts OCR:     ${health.details.receiptsOCR ? '✓' : '✗'}`);
        break;
      }

      case 'csv': {
        const options: ExportOptions = {
          year: args.year as number,
          category: args.category as string,
          deductibleOnly: args.deductibleonly as boolean,
          minAmount: args.minamount as number,
          maxAmount: args.maxamount as number,
        };

        console.log('\n📄 Exporting to CSV...');
        const result = await skill.exportToCSV(options);

        const outputPath = args.output as string;
        if (outputPath) {
          await skill.saveExport(result, outputPath);
          console.log(`✓ Saved to: ${outputPath}`);
        } else {
          console.log(result.content);
        }

        console.log(`\nRecords: ${result.recordCount}`);
        console.log(`Total: ${formatCurrency(result.totalAmount)}`);
        console.log(`Deductible: ${formatCurrency(result.deductibleAmount)}`);
        break;
      }

      case 'pdf': {
        const options: ExportOptions = {
          year: args.year as number,
          category: args.category as string,
          deductibleOnly: args.deductibleonly as boolean,
        };

        console.log('\n📑 Generating PDF report...');
        const result = await skill.generatePDF(options);

        const outputPath = (args.output as string) || result.filename;
        await skill.saveExport(result, outputPath);
        console.log(`✓ Saved to: ${outputPath}`);

        console.log(`\nRecords: ${result.recordCount}`);
        console.log(`Total: ${formatCurrency(result.totalAmount)}`);
        console.log(`Deductible: ${formatCurrency(result.deductibleAmount)}`);
        break;
      }

      case 'bundle': {
        const options: ExportOptions = {
          year: args.year as number,
          category: args.category as string,
          deductibleOnly: args.deductibleonly as boolean,
        };

        console.log('\n📦 Bundling receipts...');
        const result = await skill.bundleReceipts(options);

        const outputPath = (args.output as string) || result.filename;
        await skill.saveExport(result, outputPath);
        console.log(`✓ Saved to: ${outputPath}`);

        console.log(`\nRecords: ${result.recordCount}`);
        console.log(`Total: ${formatCurrency(result.totalAmount)}`);
        break;
      }

      case 'export': {
        const year = args.year as number || new Date().getFullYear();
        const outputDir = (args.output as string) || `tax-package-${year}`;

        console.log(`\n📁 Creating tax package for ${year}...`);
        const result = await skill.exportTaxPackage(year, outputDir);

        console.log(`✓ Tax package created: ${outputDir}`);
        console.log(`  CSV:    ${result.csvPath}`);
        console.log(`  PDF:    ${result.pdfPath}`);
        console.log(`  Bundle: ${result.bundlePath}`);
        break;
      }

      case 'irs-categories': {
        const categories = await skill.getIRSCategories();
        console.log('\n📋 IRS Schedule C Categories');
        console.log('=' .repeat(60));
        console.log('Code | Category                    | Deductible');
        console.log('-'.repeat(60));
        for (const cat of categories) {
          const rate = cat.deductibleRate === 1.0 ? '100%' : `${(cat.deductibleRate * 100).toFixed(0)}%`;
          console.log(`${cat.code.padEnd(4)} | ${cat.name.padEnd(27)} | ${rate}`);
        }
        break;
      }

      case 'mappings': {
        const mappings = await skill.getCategoryMappings();
        console.log('\n🔗 Category to IRS Mappings');
        console.log('=' .repeat(70));
        console.log('Expense Category    → IRS Category              | Rate  | Custom');
        console.log('-'.repeat(70));
        for (const m of mappings) {
          const rate = m.deductibleRate === 1.0 ? '100%' : `${(m.deductibleRate * 100).toFixed(0)}%`;
          const custom = m.isCustom ? 'Yes' : 'No';
          console.log(`${m.expenseCategory.padEnd(18)} → ${m.irsCategory.padEnd(25)} | ${rate.padEnd(5)} | ${custom}`);
        }
        break;
      }

      case 'set-mapping': {
        const expenseCategory = args.expense as string;
        const irsCategory = args.irs as string;
        const rate = args.rate as number;

        if (!expenseCategory || !irsCategory) {
          console.log('Usage: set-mapping --expense <category> --irs <category> [--rate <rate>]');
          break;
        }

        await skill.setCategoryMapping(expenseCategory, irsCategory, rate ?? 1.0);
        console.log(`✓ Mapped "${expenseCategory}" to "${irsCategory}" (${(rate ?? 1.0) * 100}%)`);
        break;
      }

      case 'history': {
        const limit = (args.limit as number) || 20;
        const history = await skill.getExportHistory(limit);
        console.log('\n📜 Export History');
        console.log('=' .repeat(80));
        console.log('Date       | Format | Records | Total      | Filename');
        console.log('-'.repeat(80));
        for (const h of history) {
          const date = formatDate(h.generatedAt);
          const total = formatCurrency(h.totalAmount).padStart(10);
          console.log(`${date} | ${h.format.padEnd(6)} | ${h.recordCount.toString().padStart(7)} | ${total} | ${h.filename}`);
        }
        break;
      }

      case 'stats': {
        const stats = await skill.getStats();
        console.log('\n📈 Export Statistics');
        console.log('=' .repeat(40));
        console.log(`Total Exports:        ${stats.totalExports}`);
        console.log(`Total Records:        ${stats.totalRecordsExported}`);
        if (stats.lastExportDate) {
          console.log(`Last Export:          ${formatDate(stats.lastExportDate)}`);
        }
        console.log('\nBy Format:');
        for (const [format, count] of Object.entries(stats.byFormat)) {
          console.log(`  ${format.padEnd(10)}: ${count}`);
        }
        break;
      }

      case 'help':
      default: {
        console.log(`
📊 Tax Export CLI

Usage: npm run cli -- <command> [options]

Commands:
  status              Check skill status
  health              Run health check
  
  csv [options]       Export to CSV format
    --year <year>           Filter by year
    --category <cat>        Filter by category
    --deductible-only       Only include deductible expenses
    --min-amount <amt>      Minimum amount filter
    --max-amount <amt>      Maximum amount filter
    --output <path>         Output file path
  
  pdf [options]       Generate PDF report (HTML format)
    --year <year>           Filter by year
    --category <cat>        Filter by category
    --deductible-only       Only include deductible expenses
    --output <path>         Output file path
  
  bundle [options]    Bundle receipt metadata
    --year <year>           Filter by year
    --category <cat>        Filter by category
    --deductible-only       Only include deductible expenses
    --output <path>         Output file path
  
  export [options]    Create complete tax package
    --year <year>           Tax year (default: current)
    --output <dir>          Output directory
  
  irs-categories      List IRS Schedule C categories
  mappings            List category to IRS mappings
  set-mapping         Set custom category mapping
    --expense <cat>         Expense category name
    --irs <cat>             IRS category name
    --rate <rate>           Deductible rate (0.0-1.0, default: 1.0)
  
  history [options]   View export history
    --limit <n>             Number of records (default: 20)
  stats               View export statistics

Examples:
  npm run cli -- csv --year 2024 --deductible-only --output expenses.csv
  npm run cli -- pdf --year 2024 --output report.html
  npm run cli -- export --year 2024 --output ./tax-2024
  npm run cli -- set-mapping --expense "Coffee" --irs "Meals" --rate 0.5
`);
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await skill.close();
  }
}

// Run CLI
main();
