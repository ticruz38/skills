---
name: invoices
description: "Create, manage, and track professional invoices"
version: 1.0.0
author: ticruz38
entry: ./invoices.py
type: script
---

# Invoices Skill

Create professional PDF invoices, track payments, and manage client billing.

## Capabilities

- `create [client] [amount] [description]` - Create a new invoice
  - Returns: Invoice ID and PDF path
  - Example: `./invoices.py create "Acme Corp" 1000 "Consulting services"`

- `list [status]` - List invoices with optional filter
  - Status: all, draft, sent, paid, overdue
  - Returns: JSON array of invoices
  - Example: `./invoices.py list overdue`

- `show [invoice_id]` - Show invoice details
  - Returns: Full invoice with line items
  - Example: `./invoices.py show INV-001`

- `send [invoice_id]` - Mark invoice as sent
  - Returns: Confirmation with sent date
  - Example: `./invoices.py send INV-001`

- `pay [invoice_id] [amount]` - Record a payment
  - Returns: Payment confirmation and balance
  - Example: `./invoices.py pay INV-001 500`

- `pdf [invoice_id]` - Generate/regenerate PDF
  - Returns: Path to PDF file
  - Example: `./invoices.py pdf INV-001`

- `client [name]` - Show client invoice history
  - Returns: All invoices for client
  - Example: `./invoices.py client "Acme Corp"`

- `report [month]` - Generate monthly report
  - Returns: Revenue, outstanding, paid amounts
  - Example: `./invoices.py report 2026-01`

## Setup

Configure your business details:
```bash
./invoices.py config --name "My Company" --email "billing@example.com"
```

## Storage

SQLite database at `~/.openclaw/skills/invoices/invoices.db`:
- `invoices` - Invoice records
- `line_items` - Individual line items
- `payments` - Payment records
- `clients` - Client information
- `config` - Business settings

PDFs stored at `~/.openclaw/skills/invoices/pdfs/`
