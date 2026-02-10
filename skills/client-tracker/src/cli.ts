#!/usr/bin/env node
/**
 * Client Tracker Skill CLI
 * Track client payment behavior and history
 */

import { ClientTrackerSkill } from './index.js';

const args = process.argv.slice(2);
const command = args[0];

async function showHelp() {
  console.log(`
Client Tracker Skill - Track client payment behavior and history

Usage: client-tracker <command> [options]

Commands:
  status                          Show connection status
  health                          Run health check
  sync                            Sync payment history from invoices
  
  list                            List all clients with summary
  profile <client-id>             Get detailed client profile
  
  payments <client-id>            View payment history
  risk <client-id>                Check credit risk score
  
  log <client-id> <message>       Add communication log entry
  communications <client-id>      View communication history
  
  balances                        Show outstanding balances report
  stats                           Show overall statistics
  export [path]                   Export client data to CSV

Examples:
  client-tracker list
  client-tracker profile 1
  client-tracker risk 1
  client-tracker log 1 "Discussed payment plan" --type call
  client-tracker balances
  client-tracker export ./clients.csv
`);
}

async function showStatus(skill: ClientTrackerSkill) {
  const health = await skill.healthCheck();
  
  console.log('\n📊 Client Tracker Status\n');
  
  console.log(`Overall: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
  console.log(`Message: ${health.message}`);
  
  if (health.invoicesStatus) {
    console.log(`\nInvoices Skill: ${health.invoicesStatus.status === 'healthy' ? '✅' : '❌'}`);
    console.log(`  ${health.invoicesStatus.message}`);
  }
  console.log();
}

async function syncHistory(skill: ClientTrackerSkill) {
  console.log('\n🔄 Syncing payment history...\n');
  
  const count = await skill.syncPaymentHistory();
  
  console.log(`✅ Synced ${count} payment records`);
}

async function listClients(skill: ClientTrackerSkill) {
  console.log('\n👥 Client List\n');
  
  const profiles = await skill.getAllClientProfiles();
  
  if (profiles.length === 0) {
    console.log('No clients found.');
    return;
  }
  
  // Header
  console.log(`${'ID'.padStart(4)} ${'Name'.padEnd(25)} ${'Invoices'.padStart(8)} ${'Revenue'.padStart(12)} ${'Outstanding'.padStart(12)} ${'Risk'.padStart(6)}`);
  console.log('-'.repeat(75));
  
  for (const profile of profiles) {
    const riskIcon = profile.riskLevel === 'low' ? '🟢' : 
                     profile.riskLevel === 'medium' ? '🟡' : '🔴';
    console.log(
      `${String(profile.id).padStart(4)} ` +
      `${profile.name.substring(0, 24).padEnd(25)} ` +
      `${String(profile.totalInvoices).padStart(8)} ` +
      `$${profile.totalRevenue.toFixed(2).padStart(10)} ` +
      `$${profile.totalOutstanding.toFixed(2).padStart(10)} ` +
      `${riskIcon} ${profile.riskLevel.substring(0, 1).toUpperCase()}`
    );
  }
  
  console.log(`\nTotal: ${profiles.length} clients`);
}

async function showProfile(skill: ClientTrackerSkill, clientId: number) {
  const profile = await skill.getClientProfile(clientId);
  
  if (!profile) {
    console.log(`\n❌ Client ${clientId} not found.`);
    return;
  }
  
  console.log(`\n👤 Client Profile: ${profile.name}\n`);
  
  console.log('Contact Information:');
  console.log(`  Email: ${profile.email || 'N/A'}`);
  console.log(`  Phone: ${profile.phone || 'N/A'}`);
  console.log(`  Address: ${profile.address || 'N/A'}`);
  if (profile.taxId) {
    console.log(`  Tax ID: ${profile.taxId}`);
  }
  
  console.log('\nPayment Statistics:');
  console.log(`  Total Invoices: ${profile.totalInvoices}`);
  console.log(`  Total Revenue: $${profile.totalRevenue.toFixed(2)}`);
  console.log(`  Total Paid: $${profile.totalPaid.toFixed(2)}`);
  console.log(`  Total Outstanding: $${profile.totalOutstanding.toFixed(2)}`);
  console.log(`  Average Payment Days: ${profile.averagePaymentDays}`);
  console.log(`  On-time Payment Rate: ${profile.onTimePaymentRate}%`);
  
  console.log('\nRisk Assessment:');
  const riskIcon = profile.riskLevel === 'low' ? '🟢' : 
                   profile.riskLevel === 'medium' ? '🟡' : '🔴';
  console.log(`  Score: ${profile.riskScore}/100 ${riskIcon}`);
  console.log(`  Level: ${profile.riskLevel.toUpperCase()}`);
  
  if (profile.lastInvoiceDate) {
    console.log(`\nLast Invoice: ${new Date(profile.lastInvoiceDate).toLocaleDateString()}`);
  }
  if (profile.lastPaymentDate) {
    console.log(`Last Payment: ${new Date(profile.lastPaymentDate).toLocaleDateString()}`);
  }
  
  if (profile.notes) {
    console.log(`\nNotes: ${profile.notes}`);
  }
}

async function showPayments(skill: ClientTrackerSkill, clientId: number) {
  const profile = await skill.getClientProfile(clientId);
  
  if (!profile) {
    console.log(`\n❌ Client ${clientId} not found.`);
    return;
  }
  
  console.log(`\n💰 Payment History: ${profile.name}\n`);
  
  const payments = await skill.getPaymentHistory(clientId);
  
  if (payments.length === 0) {
    console.log('No payment history found.');
    return;
  }
  
  // Header
  console.log(`${'Invoice'.padEnd(15)} ${'Amount'.padStart(12)} ${'Paid Date'.padStart(12)} ${'Due Date'.padStart(12)} ${'Status'.padStart(10)}`);
  console.log('-'.repeat(65));
  
  for (const payment of payments) {
    const status = payment.daysLate === 0 ? '✅ On time' : 
                   payment.daysLate <= 7 ? `⚠️  ${payment.daysLate}d late` : 
                   `🔴 ${payment.daysLate}d late`;
    
    console.log(
      `${payment.invoiceNumber.padEnd(15)} ` +
      `$${payment.amount.toFixed(2).padStart(10)} ` +
      `${new Date(payment.paidDate).toLocaleDateString().padStart(12)} ` +
      `${new Date(payment.dueDate).toLocaleDateString().padStart(12)} ` +
      `${status.padStart(10)}`
    );
  }
  
  console.log(`\nTotal: ${payments.length} payments`);
  console.log(`Average Days Late: ${profile.averagePaymentDays}`);
}

async function showRisk(skill: ClientTrackerSkill, clientId: number) {
  const risk = await skill.getRiskScore(clientId);
  
  if (!risk) {
    console.log(`\n❌ Client ${clientId} not found.`);
    return;
  }
  
  console.log(`\n📊 Credit Risk Assessment\n`);
  
  const riskIcon = risk.level === 'low' ? '🟢' : 
                   risk.level === 'medium' ? '🟡' : '🔴';
  
  console.log(`Risk Score: ${risk.score}/100`);
  console.log(`Risk Level: ${risk.level.toUpperCase()} ${riskIcon}`);
  console.log(`\nRecommendation:`);
  console.log(`  ${risk.recommendation}`);
  
  console.log('\nRisk Factors:');
  for (const factor of risk.factors) {
    const icon = factor.impact === 'positive' ? '✅' : 
                 factor.impact === 'negative' ? '❌' : '⚪';
    console.log(`\n  ${icon} ${factor.name} (weight: ${factor.weight}%)`);
    console.log(`     ${factor.description}`);
  }
}

async function addLog(skill: ClientTrackerSkill, clientId: number, message: string) {
  // Parse options
  const typeIndex = args.indexOf('--type');
  const type = typeIndex >= 0 && args[typeIndex + 1] 
    ? args[typeIndex + 1] as 'email' | 'call' | 'meeting' | 'note' | 'reminder_sent'
    : 'note';
  
  const profile = await skill.getClientProfile(clientId);
  
  if (!profile) {
    console.log(`\n❌ Client ${clientId} not found.`);
    return;
  }
  
  const log = await skill.addCommunication(clientId, { type, content: message });
  
  console.log(`\n📝 Added ${type} log for ${profile.name}`);
  console.log(`Content: ${log.content}`);
  console.log(`Date: ${new Date(log.createdAt).toLocaleString()}`);
}

async function showCommunications(skill: ClientTrackerSkill, clientId: number) {
  const profile = await skill.getClientProfile(clientId);
  
  if (!profile) {
    console.log(`\n❌ Client ${clientId} not found.`);
    return;
  }
  
  console.log(`\n📞 Communication History: ${profile.name}\n`);
  
  const logs = await skill.getCommunications(clientId);
  
  if (logs.length === 0) {
    console.log('No communication history found.');
    return;
  }
  
  for (const log of logs) {
    const icon = log.type === 'email' ? '📧' :
                 log.type === 'call' ? '📞' :
                 log.type === 'meeting' ? '🤝' :
                 log.type === 'reminder_sent' ? '⏰' : '📝';
    
    console.log(`${icon} ${log.type.toUpperCase()} - ${new Date(log.createdAt).toLocaleString()}`);
    console.log(`   ${log.content}`);
    console.log();
  }
  
  console.log(`Total: ${logs.length} entries`);
}

async function showBalances(skill: ClientTrackerSkill) {
  console.log('\n💳 Outstanding Balances Report\n');
  
  const balances = await skill.getOutstandingBalances();
  
  if (balances.length === 0) {
    console.log('No outstanding balances.');
    return;
  }
  
  // Header
  console.log(`${'Client'.padEnd(25)} ${'Outstanding'.padStart(12)} ${'Overdue'.padStart(12)} ${'Invoices'.padStart(8)} ${'Last Payment'.padStart(12)}`);
  console.log('-'.repeat(75));
  
  let totalOutstanding = 0;
  let totalOverdue = 0;
  
  for (const balance of balances) {
    if (balance.totalOutstanding === 0) continue;
    
    totalOutstanding += balance.totalOutstanding;
    totalOverdue += balance.overdueAmount;
    
    const lastPayment = balance.daysSinceLastPayment !== undefined
      ? `${balance.daysSinceLastPayment}d ago`
      : 'Never';
    
    const warning = balance.overdueAmount > 0 ? '🔴' : 
                    balance.totalOutstanding > 0 ? '🟡' : '✅';
    
    console.log(
      `${balance.clientName.substring(0, 24).padEnd(25)} ` +
      `$${balance.totalOutstanding.toFixed(2).padStart(10)} ` +
      `$${balance.overdueAmount.toFixed(2).padStart(10)} ` +
      `${String(balance.invoiceCount).padStart(8)} ` +
      `${lastPayment.padStart(12)} ${warning}`
    );
  }
  
  console.log('-'.repeat(75));
  console.log(`${'TOTAL'.padEnd(25)} $${totalOutstanding.toFixed(2).padStart(10)} $${totalOverdue.toFixed(2).padStart(10)}`);
}

async function showStats(skill: ClientTrackerSkill) {
  console.log('\n📈 Client Statistics\n');
  
  const stats = await skill.getStatistics();
  
  console.log('Overview:');
  console.log(`  Total Clients: ${stats.totalClients}`);
  console.log(`  Total Revenue: $${stats.totalRevenue.toFixed(2)}`);
  console.log(`  Total Outstanding: $${stats.totalOutstanding.toFixed(2)}`);
  console.log(`  Total Overdue: $${stats.totalOverdue.toFixed(2)}`);
  console.log(`  Average Payment Days: ${stats.averagePaymentDays}`);
  
  console.log('\nRisk Distribution:');
  console.log(`  🟢 Low Risk: ${stats.riskDistribution.low}`);
  console.log(`  🟡 Medium Risk: ${stats.riskDistribution.medium}`);
  console.log(`  🔴 High Risk: ${stats.riskDistribution.high}`);
}

async function exportData(skill: ClientTrackerSkill, filePath: string) {
  console.log(`\n📤 Exporting client data to ${filePath}...\n`);
  
  await skill.exportToCSV(filePath);
  
  console.log(`✅ Export complete!`);
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    await showHelp();
    return;
  }

  const skill = new ClientTrackerSkill();

  try {
    switch (command) {
      case 'status':
      case 'health':
        await showStatus(skill);
        break;
        
      case 'sync':
        await syncHistory(skill);
        break;
        
      case 'list':
        await listClients(skill);
        break;
        
      case 'profile':
        if (!args[1]) {
          console.log('Usage: profile <client-id>');
          process.exit(1);
        }
        await showProfile(skill, parseInt(args[1], 10));
        break;
        
      case 'payments':
        if (!args[1]) {
          console.log('Usage: payments <client-id>');
          process.exit(1);
        }
        await showPayments(skill, parseInt(args[1], 10));
        break;
        
      case 'risk':
        if (!args[1]) {
          console.log('Usage: risk <client-id>');
          process.exit(1);
        }
        await showRisk(skill, parseInt(args[1], 10));
        break;
        
      case 'log':
        if (!args[1] || !args[2]) {
          console.log('Usage: log <client-id> <message> [--type <type>]');
          process.exit(1);
        }
        await addLog(skill, parseInt(args[1], 10), args.slice(2).join(' '));
        break;
        
      case 'communications':
      case 'comms':
        if (!args[1]) {
          console.log('Usage: communications <client-id>');
          process.exit(1);
        }
        await showCommunications(skill, parseInt(args[1], 10));
        break;
        
      case 'balances':
        await showBalances(skill);
        break;
        
      case 'stats':
        await showStats(skill);
        break;
        
      case 'export':
        await exportData(skill, args[1] || './client-export.csv');
        break;
        
      default:
        console.log(`Unknown command: ${command}`);
        await showHelp();
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
