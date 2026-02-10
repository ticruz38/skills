#!/usr/bin/env node
/**
 * Receipts OCR CLI
 * Command-line interface for receipt scanning and management
 */

import { ReceiptsOCRSkill, Receipt, ReceiptLineItem } from './index';
import * as path from 'path';
import * as fs from 'fs';

// Get profile from environment or use default
const profile = process.env.GOOGLE_OAUTH_PROFILE || 'default';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function color(name: keyof typeof colors, text: string): string {
  return `${colors[name]}${text}${colors.reset}`;
}

// Format confidence with color
function formatConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return color('green', `${pct}%`);
  if (pct >= 50) return color('yellow', `${pct}%`);
  return color('red', `${pct}%`);
}

// Format currency
function formatCurrency(amount?: number): string {
  if (amount === undefined) return color('dim', 'N/A');
  return `$${amount.toFixed(2)}`;
}

// Format status with color
function formatStatus(status: string): string {
  switch (status) {
    case 'confirmed': return color('green', '✓ Confirmed');
    case 'corrected': return color('yellow', '✎ Corrected');
    case 'rejected': return color('red', '✗ Rejected');
    default: return color('cyan', '⏳ Pending');
  }
}

// Print receipt details
function printReceipt(receipt: Receipt, showLineItems = true): void {
  console.log('');
  console.log(color('bright', `Receipt #${receipt.id}`));
  console.log('─'.repeat(50));
  console.log(`  Merchant:     ${receipt.merchant || color('dim', 'Unknown')} ${formatConfidence(receipt.merchantConfidence)}`);
  console.log(`  Date:         ${receipt.date || color('dim', 'Unknown')} ${formatConfidence(receipt.dateConfidence)}`);
  console.log(`  Total:        ${color('bright', formatCurrency(receipt.totalAmount))} ${formatConfidence(receipt.totalConfidence)}`);
  console.log(`  Tax:          ${formatCurrency(receipt.taxAmount)} ${formatConfidence(receipt.taxConfidence)}`);
  console.log(`  Category:     ${receipt.category || color('dim', 'Uncategorized')}`);
  console.log(`  Payment:      ${receipt.paymentMethod || color('dim', 'Unknown')}`);
  console.log(`  Status:       ${formatStatus(receipt.status)}`);
  
  if (receipt.notes) {
    console.log(`  Notes:        ${receipt.notes}`);
  }

  if (showLineItems && receipt.lineItems.length > 0) {
    console.log('');
    console.log(color('dim', '  Line Items:'));
    console.log(`  ${color('dim', 'Description'.padEnd(30))} ${color('dim', 'Qty'.padStart(6))} ${color('dim', 'Price'.padStart(10))} ${color('dim', 'Total'.padStart(10))}`);
    for (const item of receipt.lineItems) {
      const desc = item.description.substring(0, 28).padEnd(30);
      console.log(`  ${desc} ${item.quantity.toString().padStart(6)} ${formatCurrency(item.unitPrice).padStart(10)} ${formatCurrency(item.total).padStart(10)}`);
    }
  }

  console.log(`  ${color('dim', 'Image:')} ${receipt.imagePath}`);
  console.log('');
}

// Commands
async function status(): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const status = await skill.getStatus();
    console.log('');
    console.log(color('bright', 'Receipts OCR Status'));
    console.log('─'.repeat(40));
    console.log(`  Profile:      ${profile}`);
    console.log(`  Google OAuth: ${status.connected ? color('green', 'Connected') : color('red', 'Disconnected')}`);
    console.log(`  Vision API:   ${status.hasVisionAccess ? color('green', 'Available') : color('yellow', 'Unknown')}`);
    console.log('');
  } finally {
    await skill.close();
  }
}

async function health(): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const health = await skill.healthCheck();
    console.log('');
    console.log(color('bright', 'Health Check'));
    console.log('─'.repeat(40));
    console.log(`  Status:       ${health.status === 'healthy' ? color('green', '✓ Healthy') : color('red', '✗ Unhealthy')}`);
    console.log(`  Message:      ${health.message}`);
    if (health.googleStatus) {
      console.log(`  Google:       ${health.googleStatus === 'connected' ? color('green', 'Connected') : color('red', 'Disconnected')}`);
    }
    console.log('');
  } finally {
    await skill.close();
  }
}

async function scan(imagePath: string, options: { copy?: boolean; notes?: string } = {}): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    // Check if file exists
    const fullPath = path.resolve(imagePath);
    if (!fs.existsSync(fullPath)) {
      console.error(color('red', `Error: File not found: ${fullPath}`));
      process.exit(1);
    }

    console.log(color('cyan', 'Scanning receipt...'));
    console.log(`  Image: ${fullPath}`);
    
    const receipt = await skill.processReceipt(fullPath, {
      copyImage: options.copy,
      notes: options.notes,
    });

    console.log(color('green', '✓ Receipt processed successfully!'));
    printReceipt(receipt);
  } finally {
    await skill.close();
  }
}

async function list(options: {
  status?: 'pending' | 'confirmed' | 'corrected' | 'rejected';
  limit?: number;
} = {}): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const receipts = await skill.listReceipts({
      status: options.status,
      limit: options.limit || 20,
    });

    if (receipts.length === 0) {
      console.log(color('yellow', 'No receipts found.'));
      return;
    }

    console.log('');
    console.log(color('bright', `Receipts (${receipts.length})`));
    console.log('─'.repeat(80));
    console.log(`${color('dim', 'ID'.padStart(4))} ${color('dim', 'Date'.padEnd(12))} ${color('dim', 'Merchant'.padEnd(20))} ${color('dim', 'Total'.padStart(10))} ${color('dim', 'Status'.padEnd(12))}`);
    console.log('─'.repeat(80));

    for (const receipt of receipts) {
      const id = String(receipt.id).padStart(4);
      const date = (receipt.date || color('dim', '---')).padEnd(12);
      const merchant = (receipt.merchant || color('dim', 'Unknown')).substring(0, 19).padEnd(20);
      const total = formatCurrency(receipt.totalAmount).padStart(10);
      const status = receipt.status.padEnd(12);
      console.log(`${id} ${date} ${merchant} ${total} ${status}`);
    }
    console.log('');
  } finally {
    await skill.close();
  }
}

async function get(id: number): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const receipt = await skill.getReceipt(id);
    if (!receipt) {
      console.error(color('red', `Error: Receipt #${id} not found`));
      process.exit(1);
    }
    printReceipt(receipt);
  } finally {
    await skill.close();
  }
}

async function update(id: number, options: {
  merchant?: string;
  total?: string;
  tax?: string;
  date?: string;
  category?: string;
  payment?: string;
  notes?: string;
  status?: 'pending' | 'confirmed' | 'corrected' | 'rejected';
}): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const updates: any = {};
    if (options.merchant !== undefined) updates.merchant = options.merchant;
    if (options.total !== undefined) updates.totalAmount = parseFloat(options.total);
    if (options.tax !== undefined) updates.taxAmount = parseFloat(options.tax);
    if (options.date !== undefined) updates.date = options.date;
    if (options.category !== undefined) updates.category = options.category;
    if (options.payment !== undefined) updates.paymentMethod = options.payment;
    if (options.notes !== undefined) updates.notes = options.notes;
    if (options.status !== undefined) updates.status = options.status;

    const receipt = await skill.updateReceipt(id, updates);
    console.log(color('green', '✓ Receipt updated successfully!'));
    printReceipt(receipt, false);
  } finally {
    await skill.close();
  }
}

async function confirm(id: number): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const receipt = await skill.confirmReceipt(id);
    console.log(color('green', `✓ Receipt #${id} confirmed`));
    printReceipt(receipt, false);
  } finally {
    await skill.close();
  }
}

async function reject(id: number): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const receipt = await skill.rejectReceipt(id);
    console.log(color('yellow', `✗ Receipt #${id} rejected`));
    printReceipt(receipt, false);
  } finally {
    await skill.close();
  }
}

async function remove(id: number): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const receipt = await skill.getReceipt(id);
    if (!receipt) {
      console.error(color('red', `Error: Receipt #${id} not found`));
      process.exit(1);
    }
    
    await skill.deleteReceipt(id);
    console.log(color('green', `✓ Receipt #${id} deleted`));
  } finally {
    await skill.close();
  }
}

async function stats(): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const stats = await skill.getStats();

    console.log('');
    console.log(color('bright', 'Receipt Statistics'));
    console.log('─'.repeat(40));
    console.log(`  Total Receipts: ${color('bright', String(stats.totalReceipts))}`);
    console.log(`  Total Amount:   ${color('bright', formatCurrency(stats.totalAmount))}`);
    console.log(`  Avg Confidence: ${formatConfidence(stats.averageConfidence)}`);
    console.log('');

    if (Object.keys(stats.byStatus).length > 0) {
      console.log(color('dim', '  By Status:'));
      for (const [status, data] of Object.entries(stats.byStatus)) {
        console.log(`    ${status.padEnd(12)} ${String(data.count).padStart(4)} receipts  ${formatCurrency(data.amount).padStart(10)}`);
      }
      console.log('');
    }

    if (Object.keys(stats.byCategory).length > 0) {
      console.log(color('dim', '  By Category:'));
      for (const [category, data] of Object.entries(stats.byCategory)) {
        console.log(`    ${category.padEnd(15)} ${String(data.count).padStart(4)} receipts  ${formatCurrency(data.amount).padStart(10)}`);
      }
      console.log('');
    }
  } finally {
    await skill.close();
  }
}

async function exportCSV(outputPath?: string): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const csv = await skill.exportToCSV();
    
    if (outputPath) {
      fs.writeFileSync(outputPath, csv);
      console.log(color('green', `✓ Exported to: ${outputPath}`));
    } else {
      console.log(csv);
    }
  } finally {
    await skill.close();
  }
}

async function text(imagePath: string): Promise<void> {
  const skill = new ReceiptsOCRSkill({ profile });
  try {
    const fullPath = path.resolve(imagePath);
    if (!fs.existsSync(fullPath)) {
      console.error(color('red', `Error: File not found: ${fullPath}`));
      process.exit(1);
    }

    console.log(color('cyan', 'Extracting text from receipt...'));
    const extraction = await skill.performOCR(fullPath);

    console.log('');
    console.log(color('bright', 'Extracted Data'));
    console.log('─'.repeat(40));
    console.log(`  Merchant:     ${extraction.merchant || color('dim', 'Unknown')} ${formatConfidence(extraction.merchantConfidence)}`);
    console.log(`  Total:        ${formatCurrency(extraction.totalAmount)} ${formatConfidence(extraction.totalConfidence)}`);
    console.log(`  Tax:          ${formatCurrency(extraction.taxAmount)} ${formatConfidence(extraction.taxConfidence)}`);
    console.log(`  Date:         ${extraction.date || color('dim', 'Unknown')} ${formatConfidence(extraction.dateConfidence)}`);
    console.log(`  Category:     ${extraction.category || color('dim', 'Uncategorized')}`);
    console.log(`  Payment:      ${extraction.paymentMethod || color('dim', 'Unknown')}`);
    
    if (extraction.lineItems.length > 0) {
      console.log('');
      console.log(color('dim', '  Line Items:'));
      for (const item of extraction.lineItems) {
        console.log(`    • ${item.description} x${item.quantity} = ${formatCurrency(item.total)}`);
      }
    }

    console.log('');
    console.log(color('bright', 'Raw Text'));
    console.log('─'.repeat(40));
    console.log(extraction.rawText);
  } finally {
    await skill.close();
  }
}

// Main CLI
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log('');
    console.log(color('bright', 'Receipts OCR CLI'));
    console.log(color('dim', 'Extract data from receipt photos using Google Vision API'));
    console.log('');
    console.log(color('bright', 'Commands:'));
    console.log('  status                    Check connection status');
    console.log('  health                    Perform health check');
    console.log('  scan <image>              Scan a receipt image');
    console.log('    --copy                  Copy image to storage');
    console.log('    --notes <text>          Add notes to receipt');
    console.log('  text <image>              Extract text without saving');
    console.log('  list                      List all receipts');
    console.log('    --status <status>       Filter by status (pending, confirmed, corrected, rejected)');
    console.log('    --limit <n>             Limit results (default: 20)');
    console.log('  get <id>                  Get receipt details');
    console.log('  update <id>               Update receipt fields');
    console.log('    --merchant <name>       Update merchant');
    console.log('    --total <amount>        Update total amount');
    console.log('    --tax <amount>          Update tax amount');
    console.log('    --date <YYYY-MM-DD>     Update date');
    console.log('    --category <cat>        Update category');
    console.log('    --payment <method>      Update payment method');
    console.log('    --notes <text>          Update notes');
    console.log('    --status <status>       Update status');
    console.log('  confirm <id>              Confirm receipt as accurate');
    console.log('  reject <id>               Reject receipt as invalid');
    console.log('  delete <id>               Delete receipt');
    console.log('  stats                     Show receipt statistics');
    console.log('  export [path]             Export receipts to CSV');
    console.log('');
    console.log(color('dim', 'Environment:'));
    console.log('  GOOGLE_OAUTH_PROFILE      OAuth profile to use (default: default)');
    console.log('');
    return;
  }

  try {
    switch (command) {
      case 'status':
        await status();
        break;
      case 'health':
        await health();
        break;
      case 'scan': {
        const imagePath = args[1];
        if (!imagePath) {
          console.error(color('red', 'Error: Image path required'));
          process.exit(1);
        }
        const copy = args.includes('--copy');
        const notesIndex = args.indexOf('--notes');
        const notes = notesIndex >= 0 ? args[notesIndex + 1] : undefined;
        await scan(imagePath, { copy, notes });
        break;
      }
      case 'text': {
        const imagePath = args[1];
        if (!imagePath) {
          console.error(color('red', 'Error: Image path required'));
          process.exit(1);
        }
        await text(imagePath);
        break;
      }
      case 'list': {
        const statusIndex = args.indexOf('--status');
        const status = statusIndex >= 0 ? args[statusIndex + 1] as any : undefined;
        const limitIndex = args.indexOf('--limit');
        const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined;
        await list({ status, limit });
        break;
      }
      case 'get': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error(color('red', 'Error: Invalid receipt ID'));
          process.exit(1);
        }
        await get(id);
        break;
      }
      case 'update': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error(color('red', 'Error: Invalid receipt ID'));
          process.exit(1);
        }
        const merchantIndex = args.indexOf('--merchant');
        const totalIndex = args.indexOf('--total');
        const taxIndex = args.indexOf('--tax');
        const dateIndex = args.indexOf('--date');
        const categoryIndex = args.indexOf('--category');
        const paymentIndex = args.indexOf('--payment');
        const notesIndex = args.indexOf('--notes');
        const statusIndex = args.indexOf('--status');
        
        await update(id, {
          merchant: merchantIndex >= 0 ? args[merchantIndex + 1] : undefined,
          total: totalIndex >= 0 ? args[totalIndex + 1] : undefined,
          tax: taxIndex >= 0 ? args[taxIndex + 1] : undefined,
          date: dateIndex >= 0 ? args[dateIndex + 1] : undefined,
          category: categoryIndex >= 0 ? args[categoryIndex + 1] : undefined,
          payment: paymentIndex >= 0 ? args[paymentIndex + 1] : undefined,
          notes: notesIndex >= 0 ? args[notesIndex + 1] : undefined,
          status: statusIndex >= 0 ? args[statusIndex + 1] as any : undefined,
        });
        break;
      }
      case 'confirm': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error(color('red', 'Error: Invalid receipt ID'));
          process.exit(1);
        }
        await confirm(id);
        break;
      }
      case 'reject': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error(color('red', 'Error: Invalid receipt ID'));
          process.exit(1);
        }
        await reject(id);
        break;
      }
      case 'delete':
      case 'remove': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error(color('red', 'Error: Invalid receipt ID'));
          process.exit(1);
        }
        await remove(id);
        break;
      }
      case 'stats':
        await stats();
        break;
      case 'export': {
        const outputPath = args[1];
        await exportCSV(outputPath);
        break;
      }
      default:
        console.error(color('red', `Unknown command: ${command}`));
        console.log('Run without arguments for help.');
        process.exit(1);
    }
  } catch (error) {
    console.error(color('red', `Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

main();
