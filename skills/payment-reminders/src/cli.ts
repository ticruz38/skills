#!/usr/bin/env node
/**
 * Payment Reminders Skill CLI
 * Automated payment reminder emails for invoice chasing
 */

import { PaymentRemindersSkill, ReminderSchedule, ReminderTemplate } from './index.js';
import { InvoicesSkill } from '@openclaw/invoices';

const args = process.argv.slice(2);
const command = args[0];

async function showHelp() {
  console.log(`
Payment Reminders Skill - Automated invoice chasing

Usage: payment-reminders <command> [options]

Commands:
  status                    Show connection status
  health                    Run health check
  
  schedules                 List all reminder schedules
  schedule-create           Create a new schedule
  schedule-get <id>         Get schedule details
  
  templates [stage]         List reminder templates
  template-get <id>         Get template details
  template-create           Create a new template
  
  client-settings <id>      Get client reminder settings
  client-enable <id>        Enable reminders for client
  client-disable <id>       Disable reminders for client
  
  pending                   List all pending reminders
  send-all [--dry-run]      Send all pending reminders
  preview <invoice-id>      Preview reminder for invoice
  send <invoice-id>         Send reminder for specific invoice
  
  history [invoice-id]      Show reminder history
  stats                     Show reminder statistics

Examples:
  payment-reminders pending
  payment-reminders send-all --dry-run
  payment-reminders send INV-0001
  payment-reminders templates post_due
`);
}

async function showStatus(skill: PaymentRemindersSkill) {
  const health = await skill.healthCheck();
  
  console.log('\n📊 Payment Reminders Status\n');
  
  console.log(`Overall: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
  console.log(`Message: ${health.message}`);
  
  if (health.invoicesStatus) {
    console.log(`\nInvoices Skill: ${health.invoicesStatus.status === 'healthy' ? '✅' : '❌'}`);
    console.log(`  ${health.invoicesStatus.message}`);
  }
  
  if (health.emailStatus) {
    console.log(`\nEmail Skill: ${health.emailStatus.connected ? '✅ Connected' : '❌ Not connected'}`);
    if (health.emailStatus.email) {
      console.log(`  Account: ${health.emailStatus.email}`);
    }
  }
  console.log();
}

async function listSchedules(skill: PaymentRemindersSkill) {
  const schedules = await skill.getSchedules();
  
  console.log('\n📅 Reminder Schedules\n');
  
  if (schedules.length === 0) {
    console.log('No schedules found.');
    return;
  }
  
  for (const schedule of schedules) {
    const defaultTag = schedule.isDefault ? ' [DEFAULT]' : '';
    console.log(`${schedule.id}. ${schedule.name}${defaultTag}`);
    console.log(`   Days before due: ${schedule.daysBeforeDue.join(', ') || 'None'}`);
    console.log(`   On due date: ${schedule.onDueDate ? 'Yes' : 'No'}`);
    console.log(`   Days after due: ${schedule.daysAfterDue.join(', ') || 'None'}`);
    console.log();
  }
}

async function createSchedule(skill: PaymentRemindersSkill) {
  console.log('\n➕ Create New Reminder Schedule\n');
  
  // In a real CLI, you'd use a library like inquirer for interactive prompts
  // For now, we'll use a simple approach with environment variables or defaults
  
  const name = process.env.REMINDER_NAME || 'Custom Schedule';
  const daysBeforeDue = (process.env.DAYS_BEFORE || '7,3').split(',').map(Number);
  const daysAfterDue = (process.env.DAYS_AFTER || '7,14,30').split(',').map(Number);
  const onDueDate = process.env.ON_DUE_DATE !== 'false';
  const isDefault = process.env.IS_DEFAULT === 'true';
  
  const schedule = await skill.createSchedule({
    name,
    daysBeforeDue,
    daysAfterDue,
    onDueDate,
    isDefault,
  });
  
  console.log(`✅ Created schedule: ${schedule.name} (ID: ${schedule.id})`);
}

async function listTemplates(skill: PaymentRemindersSkill, stage?: string) {
  const templates = await skill.getTemplates(stage ? { stage } : {});
  
  console.log(`\n📝 Reminder Templates${stage ? ` (${stage})` : ''}\n`);
  
  if (templates.length === 0) {
    console.log('No templates found.');
    return;
  }
  
  for (const template of templates) {
    const defaultTag = template.isDefault ? ' [DEFAULT]' : '';
    console.log(`${template.id}. ${template.name}${defaultTag}`);
    console.log(`   Stage: ${template.stage} | Tone: ${template.tone}`);
    console.log(`   Subject: ${template.subject}`);
    console.log();
  }
}

async function getTemplate(skill: PaymentRemindersSkill, id: number) {
  const template = await skill.getTemplate(id);
  
  if (!template) {
    console.log(`Template ${id} not found.`);
    return;
  }
  
  console.log(`\n📝 Template: ${template.name}\n`);
  console.log(`ID: ${template.id}`);
  console.log(`Stage: ${template.stage}`);
  console.log(`Tone: ${template.tone}`);
  console.log(`Default: ${template.isDefault ? 'Yes' : 'No'}`);
  console.log(`Subject: ${template.subject}`);
  console.log(`\nBody Text:\n${template.bodyText}`);
  if (template.bodyHtml) {
    console.log(`\nBody HTML:\n${template.bodyHtml}`);
  }
}

async function createTemplate(skill: PaymentRemindersSkill) {
  console.log('\n➕ Create New Reminder Template\n');
  console.log('Note: Use environment variables to set template properties:');
  console.log('  TEMPLATE_NAME - Template name');
  console.log('  TEMPLATE_STAGE - pre_due, on_due, post_due, final');
  console.log('  TEMPLATE_TONE - friendly, firm, urgent');
  console.log('  TEMPLATE_SUBJECT - Email subject');
  console.log('  TEMPLATE_BODY - Email body text');
  console.log('  IS_DEFAULT - Set as default for stage (true/false)');
  console.log();
  
  const name = process.env.TEMPLATE_NAME;
  const stage = process.env.TEMPLATE_STAGE as ReminderTemplate['stage'];
  const tone = process.env.TEMPLATE_TONE as ReminderTemplate['tone'];
  const subject = process.env.TEMPLATE_SUBJECT;
  const bodyText = process.env.TEMPLATE_BODY;
  const isDefault = process.env.IS_DEFAULT === 'true';
  
  if (!name || !stage || !tone || !subject || !bodyText) {
    console.log('❌ Missing required environment variables.');
    return;
  }
  
  const validStages: ReminderTemplate['stage'][] = ['pre_due', 'on_due', 'post_due', 'final'];
  const validTones: ReminderTemplate['tone'][] = ['friendly', 'firm', 'urgent'];
  
  if (!validStages.includes(stage)) {
    console.log(`❌ Invalid stage: ${stage}`);
    return;
  }
  
  if (!validTones.includes(tone)) {
    console.log(`❌ Invalid tone: ${tone}`);
    return;
  }
  
  const template = await skill.createTemplate({
    name,
    subject,
    bodyText,
    stage,
    tone,
    isDefault,
  });
  
  console.log(`✅ Created template: ${template.name} (ID: ${template.id})`);
}

async function getClientSettings(skill: PaymentRemindersSkill, clientId: number) {
  const settings = await skill.getClientSettings(clientId);
  
  console.log(`\n👤 Client Settings (ID: ${clientId})\n`);
  
  if (!settings) {
    console.log('Using default settings (enabled, default schedule)');
    return;
  }
  
  console.log(`Reminders Enabled: ${settings.enabled ? '✅ Yes' : '❌ No'}`);
  console.log(`Custom Schedule ID: ${settings.scheduleId || 'Default'}`);
  console.log(`Custom Templates: ${settings.customTemplates ? 'Yes' : 'No'}`);
  if (settings.notes) {
    console.log(`Notes: ${settings.notes}`);
  }
  console.log(`Last Updated: ${settings.updatedAt}`);
}

async function setClientEnabled(skill: PaymentRemindersSkill, clientId: number, enabled: boolean) {
  // Get existing settings or create new
  const existing = await skill.getClientSettings(clientId);
  
  await skill.setClientSettings({
    clientId,
    enabled,
    scheduleId: existing?.scheduleId,
    customTemplates: existing?.customTemplates,
    notes: existing?.notes,
  });
  
  console.log(`✅ Reminders ${enabled ? 'enabled' : 'disabled'} for client ${clientId}`);
}

async function listPending(skill: PaymentRemindersSkill) {
  const pending = await skill.getPendingReminders();
  
  console.log('\n⏰ Pending Reminders\n');
  
  if (pending.length === 0) {
    console.log('No pending reminders found.');
    return;
  }
  
  for (const item of pending) {
    const status = item.daysUntilDue >= 0 
      ? `Due in ${item.daysUntilDue} days`
      : `${item.daysOverdue} days overdue`;
    
    console.log(`${item.invoice.invoiceNumber} - ${item.client.name}`);
    console.log(`   Amount: $${item.invoice.balanceDue.toFixed(2)}`);
    console.log(`   Status: ${status}`);
    console.log(`   Stage: ${item.stage}`);
    console.log(`   Template: ${item.template.name}`);
    console.log(`   Email: ${item.client.email}`);
    console.log();
  }
  
  console.log(`Total: ${pending.length} pending reminders`);
}

async function sendAll(skill: PaymentRemindersSkill, dryRun: boolean) {
  console.log(`\n📤 Sending Pending Reminders${dryRun ? ' (DRY RUN)' : ''}\n`);
  
  const result = await skill.sendAllPending({ dryRun });
  
  console.log(`Total: ${result.total}`);
  console.log(`Sent: ${result.sent}`);
  console.log(`Failed: ${result.failed}`);
  
  if (result.results.length > 0) {
    console.log('\nDetails:');
    for (const r of result.results) {
      const icon = r.success ? '✅' : '❌';
      console.log(`  ${icon} ${r.invoiceNumber}${r.error ? ` - ${r.error}` : ''}`);
    }
  }
}

async function previewReminder(skill: PaymentRemindersSkill, invoiceId: string) {
  // Try to find invoice by number or ID
  const invoices = await skill['invoicesSkill'].listInvoices();
  let invoice: typeof invoices[0] | null = invoices.find(i => i.invoiceNumber === invoiceId) || null;
  
  if (!invoice) {
    const id = parseInt(invoiceId, 10);
    if (!isNaN(id)) {
      invoice = await skill['invoicesSkill'].getInvoice(id);
    }
  }
  
  if (!invoice) {
    console.log(`Invoice ${invoiceId} not found.`);
    return;
  }
  
  const preview = await skill.previewReminder(invoice.id!);
  
  if (!preview) {
    console.log('Could not generate preview.');
    return;
  }
  
  console.log('\n👁️  Reminder Preview\n');
  console.log(`Invoice: ${preview.invoice.invoiceNumber}`);
  console.log(`Client: ${preview.client.name} (${preview.client.email})`);
  console.log(`Template: ${preview.template.name}`);
  console.log(`\nSubject: ${preview.subject}`);
  console.log(`\nBody:\n${'-'.repeat(50)}`);
  console.log(preview.bodyText);
  console.log('-'.repeat(50));
}

async function sendReminder(skill: PaymentRemindersSkill, invoiceId: string) {
  // Try to find invoice by number or ID
  const invoices = await skill['invoicesSkill'].listInvoices();
  let invoice: typeof invoices[0] | null = invoices.find(i => i.invoiceNumber === invoiceId) || null;
  
  if (!invoice) {
    const id = parseInt(invoiceId, 10);
    if (!isNaN(id)) {
      invoice = await skill['invoicesSkill'].getInvoice(id);
    }
  }
  
  if (!invoice) {
    console.log(`Invoice ${invoiceId} not found.`);
    return;
  }
  
  // Get pending reminders
  const pending = await skill.getPendingReminders();
  const reminder = pending.find(p => p.invoice.id === invoice.id);
  
  if (!reminder) {
    console.log('No reminder is due for this invoice at this time.');
    return;
  }
  
  console.log(`\n📤 Sending reminder for ${invoice.invoiceNumber}...\n`);
  
  const result = await skill.sendReminder(reminder);
  
  if (result.success) {
    console.log('✅ Reminder sent successfully!');
    console.log(`History ID: ${result.historyId}`);
  } else {
    console.log('❌ Failed to send reminder.');
    console.log(`Error: ${result.error}`);
  }
}

async function showHistory(skill: PaymentRemindersSkill, invoiceId?: string) {
  console.log('\n📜 Reminder History\n');
  
  let history: any[] = [];
  
  if (invoiceId) {
    const id = parseInt(invoiceId, 10);
    if (!isNaN(id)) {
      history = await skill.getInvoiceReminderHistory(id);
    }
  } else {
    const stats = await skill.getStats();
    history = stats.recentActivity;
  }
  
  if (history.length === 0) {
    console.log('No history found.');
    return;
  }
  
  for (const h of history) {
    const icon = h.sentSuccessfully ? '✅' : '❌';
    console.log(`${icon} ${new Date(h.sentAt).toLocaleString()}`);
    console.log(`   Invoice ID: ${h.invoiceId} | Stage: ${h.stage}`);
    console.log(`   Subject: ${h.subject}`);
    if (h.errorMessage) {
      console.log(`   Error: ${h.errorMessage}`);
    }
    console.log();
  }
}

async function showStats(skill: PaymentRemindersSkill) {
  const stats = await skill.getStats();
  
  console.log('\n📊 Reminder Statistics\n');
  console.log(`Total Reminders Sent: ${stats.totalRemindersSent}`);
  console.log(`Successful: ${stats.successfulReminders}`);
  console.log(`Failed: ${stats.failedReminders}`);
  
  if (Object.keys(stats.byStage).length > 0) {
    console.log('\nBy Stage:');
    for (const [stage, count] of Object.entries(stats.byStage)) {
      console.log(`  ${stage}: ${count}`);
    }
  }
  
  if (stats.recentActivity.length > 0) {
    console.log('\nRecent Activity:');
    for (const activity of stats.recentActivity.slice(0, 5)) {
      const icon = activity.sentSuccessfully ? '✅' : '❌';
      console.log(`  ${icon} ${activity.stage} - ${new Date(activity.sentAt).toLocaleDateString()}`);
    }
  }
  console.log();
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    await showHelp();
    return;
  }

  const skill = new PaymentRemindersSkill();

  try {
    switch (command) {
      case 'status':
      case 'health':
        await showStatus(skill);
        break;
        
      case 'schedules':
        await listSchedules(skill);
        break;
        
      case 'schedule-create':
        await createSchedule(skill);
        break;
        
      case 'templates':
        await listTemplates(skill, args[1]);
        break;
        
      case 'template-get':
        if (!args[1]) {
          console.log('Usage: template-get <id>');
          process.exit(1);
        }
        await getTemplate(skill, parseInt(args[1], 10));
        break;
        
      case 'template-create':
        await createTemplate(skill);
        break;
        
      case 'client-settings':
        if (!args[1]) {
          console.log('Usage: client-settings <client-id>');
          process.exit(1);
        }
        await getClientSettings(skill, parseInt(args[1], 10));
        break;
        
      case 'client-enable':
        if (!args[1]) {
          console.log('Usage: client-enable <client-id>');
          process.exit(1);
        }
        await setClientEnabled(skill, parseInt(args[1], 10), true);
        break;
        
      case 'client-disable':
        if (!args[1]) {
          console.log('Usage: client-disable <client-id>');
          process.exit(1);
        }
        await setClientEnabled(skill, parseInt(args[1], 10), false);
        break;
        
      case 'pending':
        await listPending(skill);
        break;
        
      case 'send-all':
        await sendAll(skill, args.includes('--dry-run'));
        break;
        
      case 'preview':
        if (!args[1]) {
          console.log('Usage: preview <invoice-number>');
          process.exit(1);
        }
        await previewReminder(skill, args[1]);
        break;
        
      case 'send':
        if (!args[1]) {
          console.log('Usage: send <invoice-number>');
          process.exit(1);
        }
        await sendReminder(skill, args[1]);
        break;
        
      case 'history':
        await showHistory(skill, args[1]);
        break;
        
      case 'stats':
        await showStats(skill);
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
