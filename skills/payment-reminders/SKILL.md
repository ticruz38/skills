---
title: Payment Reminders
skill_id: payment-reminders
description: Automated payment reminder emails for invoice chasing
category: finance
version: 1.0.0
---

# Payment Reminders

Automated payment reminder system that sends escalating reminder emails for overdue and upcoming invoices.

## Capabilities

- **Escalating Reminder Schedule**: Configurable reminders before and after due dates
- **Email Template Customization**: Friendly, firm, and urgent tone templates
- **Payment Status Tracking**: Full history of all reminders sent
- **Client-Specific Settings**: Enable/disable reminders per client with custom schedules
- **Dry Run Mode**: Preview reminders before sending

## Reminder Stages

1. **Pre-Due**: Friendly reminders before the due date (e.g., 7 days, 3 days before)
2. **On Due**: Reminder on the actual due date
3. **Post-Due**: Follow-up reminders after the due date (e.g., 7, 14, 30 days after)
4. **Final**: Urgent final notice for severely overdue invoices (30+ days)

## Default Schedules

### Standard Schedule (Default)
- Before due: 7 days, 3 days
- On due date: Yes
- After due: 7, 14, 30 days

### Gentle Schedule
- Before due: 3 days
- On due date: Yes
- After due: 7 days

### Aggressive Schedule
- Before due: 14, 7, 3 days
- On due date: Yes
- After due: 3, 7, 14, 30 days

## Template Variables

Use these variables in your templates:

- `{{clientName}}` - Client's name
- `{{invoiceNumber}}` - Invoice number
- `{{amount}}` - Balance due amount
- `{{dueDate}}` - Invoice due date
- `{{daysUntilDue}}` - Days until due (positive number)
- `{{daysOverdue}}` - Days overdue (positive number)
- `{{businessName}}` - Your business name
- `{{businessEmail}}` - Your business email
- `{{businessPhone}}` - Your business phone

## Installation

```bash
cd skills/payment-reminders
npm install
npm run build
```

## Configuration

Set your email profile (uses the email skill):

```bash
export EMAIL_PROFILE=default  # or your Gmail profile name
```

## Usage

### Check Status

```bash
npm run cli status
```

### List Pending Reminders

```bash
npm run cli pending
```

### Preview a Reminder

```bash
npm run cli preview INV-0001
```

### Send All Pending Reminders (Dry Run)

```bash
npm run cli send-all --dry-run
```

### Send All Pending Reminders

```bash
npm run cli send-all
```

### Send Single Reminder

```bash
npm run cli send INV-0001
```

### Manage Client Settings

```bash
# View client settings
npm run cli client-settings 1

# Enable reminders for client
npm run cli client-enable 1

# Disable reminders for client
npm run cli client-disable 1
```

### Manage Templates

```bash
# List all templates
npm run cli templates

# List templates for specific stage
npm run cli templates post_due

# View template details
npm run cli template-get 1

# Create new template (via environment variables)
TEMPLATE_NAME="Custom Overdue" \
TEMPLATE_STAGE=post_due \
TEMPLATE_TONE=firm \
TEMPLATE_SUBJECT="Overdue: Invoice {{invoiceNumber}}" \
TEMPLATE_BODY="Dear {{clientName}},..." \
npm run cli template-create
```

### View Statistics

```bash
npm run cli stats
npm run cli history
```

## API Usage

```typescript
import { PaymentRemindersSkill } from '@openclaw/payment-reminders';

const skill = new PaymentRemindersSkill();

// Get pending reminders
const pending = await skill.getPendingReminders();

// Send all pending
const result = await skill.sendAllPending();
console.log(`Sent ${result.sent} reminders`);

// Preview reminder
const preview = await skill.previewReminder(invoiceId);
console.log(preview.subject);
console.log(preview.bodyText);

// Send specific reminder
await skill.sendReminder(pending[0]);

// Get statistics
const stats = await skill.getStats();

await skill.close();
```

## Database Schema

### reminder_schedules
- `id` - Schedule ID
- `name` - Schedule name
- `days_before_due` - JSON array of days
- `days_after_due` - JSON array of days
- `on_due_date` - Send on due date flag
- `is_default` - Default schedule flag

### reminder_templates
- `id` - Template ID
- `name` - Template name
- `subject` - Email subject with variables
- `body_text` - Plain text body
- `body_html` - HTML body (optional)
- `stage` - pre_due, on_due, post_due, final
- `tone` - friendly, firm, urgent
- `is_default` - Default for stage

### client_settings
- `client_id` - Client ID
- `enabled` - Reminders enabled flag
- `schedule_id` - Custom schedule ID
- `custom_templates` - Use custom templates
- `notes` - Notes about client

### reminder_history
- `id` - History entry ID
- `invoice_id` - Invoice ID
- `client_id` - Client ID
- `stage` - Reminder stage sent
- `template_id` - Template used
- `subject` - Actual subject sent
- `body_preview` - Body preview
- `sent_at` - Timestamp
- `sent_successfully` - Success flag
- `error_message` - Error if failed

## Dependencies

- @openclaw/invoices - For invoice data
- @openclaw/email - For sending emails
- sqlite3 - For local storage
