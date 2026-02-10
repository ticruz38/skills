#!/usr/bin/env node
/**
 * Client CRM CLI
 * Command-line interface for real estate client relationship management
 */

import { ClientCRMSkill, ClientType, PipelineStage, UrgencyLevel, ClientStatus, CommunicationType } from './index';

const args = process.argv.slice(2);
const command = args[0];

function showHelp(): void {
  console.log(`
Client CRM - Real Estate Client Relationship Management

Usage: client-crm <command> [options]

Commands:
  Client Management:
    add [options]                 Add a new client
    list [options]                List clients with filters
    get <id>                      Get client details
    update <id> [options]         Update a client
    delete <id>                   Delete a client
    search <query>                Search clients by text
    
  Pipeline:
    pipeline <id> --stage <stage> Update pipeline stage
    pipeline-list                 View pipeline statistics
    
  Preferences:
    preferences <id> [options]    Set property preferences
    preferences-get <id>          Get property preferences
    
  Communications:
    log <id> [options]            Add communication log
    communications <id>           View communication history
    
  Follow-ups:
    follow-ups [options]          List upcoming follow-ups
    set-follow-up <id> [options]  Set follow-up date
    
  Search:
    by-location <location>        Find clients by location
    by-feature <feature>          Find clients by feature preference
    
  Import/Export:
    export [options]              Export clients to CSV
    import [options]              Import clients from CSV
    
  Reporting:
    stats                         View statistics
    health                        Check system health

Options:
  add:
    --name <name>                 Client name (required)
    --email <email>               Email address
    --phone <phone>               Phone number
    --phone2 <phone>              Secondary phone
    --address <address>           Physical address
    --type <type>                 Client type: buyer, seller, renter, investor, vendor, other
    --status <status>             Status: active, inactive, on_hold, closed
    --stage <stage>               Pipeline stage: lead, qualified, viewing, offer, under_contract, closed, archived
    --urgency <level>             Urgency: low, medium, high, urgent
    --source <source>             Lead source
    --budget-min <amount>         Minimum budget
    --budget-max <amount>         Maximum budget
    --timeline <timeline>         Timeline description
    --notes <notes>               Notes

  list:
    --type <type>                 Filter by type
    --status <status>             Filter by status
    --stage <stage>               Filter by pipeline stage
    --urgency <level>             Filter by urgency
    --source <source>             Filter by source
    --follow-up                   Only show clients with follow-ups

  log:
    --type <type>                 Communication type: call, email, meeting, showing, text, note, other
    --content <text>              Log content (required)
    --property <id>               Related property ID

  follow-ups, set-follow-up:
    --days <n>                    Number of days to look ahead (default: 7)
    --date <date>                 Follow-up date (YYYY-MM-DD)
    --notes <notes>               Notes for follow-up

  preferences:
    --min-price <amount>          Minimum price
    --max-price <amount>          Maximum price
    --min-beds <n>                Minimum bedrooms
    --max-beds <n>                Maximum bedrooms
    --min-baths <n>               Minimum bathrooms
    --max-baths <n>               Maximum bathrooms
    --min-sqft <n>                Minimum square feet
    --max-sqft <n>                Maximum square feet
    --locations <list>            Comma-separated locations
    --types <list>                Comma-separated property types
    --must-have <list>            Comma-separated must-have features
    --nice-to-have <list>         Comma-separated nice-to-have features

  export, import:
    --file <path>                 File path (default: ./clients.csv)

Examples:
  client-crm add --name "John Smith" --email "john@example.com" --type buyer --stage lead
  client-crm list --type buyer --stage qualified
  client-crm pipeline 1 --stage viewing
  client-crm preferences 1 --min-price 400000 --max-price 600000 --beds 3
  client-crm log 1 --type meeting --content "Discussed requirements"
  client-crm follow-ups --days 7
  client-crm stats
`);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

async function main(): Promise<void> {
  const skill = new ClientCRMSkill();

  try {
    switch (command) {
      case 'add': {
        const name = args.find((_, i) => args[i - 1] === '--name');
        const email = args.find((_, i) => args[i - 1] === '--email');
        const phone = args.find((_, i) => args[i - 1] === '--phone');
        const phone2 = args.find((_, i) => args[i - 1] === '--phone2');
        const address = args.find((_, i) => args[i - 1] === '--address');
        const type = args.find((_, i) => args[i - 1] === '--type') as ClientType;
        const status = args.find((_, i) => args[i - 1] === '--status') as ClientStatus;
        const stage = args.find((_, i) => args[i - 1] === '--stage') as PipelineStage;
        const urgency = args.find((_, i) => args[i - 1] === '--urgency') as UrgencyLevel;
        const source = args.find((_, i) => args[i - 1] === '--source');
        const budgetMin = args.find((_, i) => args[i - 1] === '--budget-min');
        const budgetMax = args.find((_, i) => args[i - 1] === '--budget-max');
        const timeline = args.find((_, i) => args[i - 1] === '--timeline');
        const notes = args.find((_, i) => args[i - 1] === '--notes');

        if (!name) {
          console.error('Error: --name is required');
          process.exit(1);
        }

        const client = await skill.addClient({
          name,
          email,
          phone,
          phone2,
          address,
          type: type || 'buyer',
          status: status || 'active',
          pipelineStage: stage || 'lead',
          urgency: urgency || 'medium',
          source,
          budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
          budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
          timeline,
          notes,
        });

        console.log(`✓ Client added successfully (ID: ${client.id})`);
        console.log(`  Name: ${client.name}`);
        console.log(`  Type: ${client.type}`);
        console.log(`  Stage: ${client.pipelineStage}`);
        break;
      }

      case 'list': {
        const type = args.find((_, i) => args[i - 1] === '--type') as ClientType;
        const status = args.find((_, i) => args[i - 1] === '--status') as ClientStatus;
        const stage = args.find((_, i) => args[i - 1] === '--stage') as PipelineStage;
        const urgency = args.find((_, i) => args[i - 1] === '--urgency') as UrgencyLevel;
        const source = args.find((_, i) => args[i - 1] === '--source');
        const hasFollowUp = args.includes('--follow-up');

        const clients = await skill.listClients({
          type,
          status,
          stage,
          urgency,
          source,
          hasFollowUp,
        });

        if (clients.length === 0) {
          console.log('No clients found.');
          break;
        }

        console.log(`\nFound ${clients.length} client(s):\n`);
        console.log('ID  | Name                 | Type    | Stage      | Status  | Urgency  | Follow-up');
        console.log('----|----------------------|---------|------------|---------|----------|------------');
        
        for (const c of clients) {
          const name = c.name.substring(0, 20).padEnd(20);
          const followUp = c.followUpDate ? formatDate(c.followUpDate) : '-';
          console.log(`${String(c.id).padStart(3)} | ${name} | ${c.type.padEnd(7)} | ${c.pipelineStage.padEnd(10)} | ${c.status.padEnd(7)} | ${c.urgency.padEnd(8)} | ${followUp}`);
        }
        break;
      }

      case 'get': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const client = await skill.getClient(id);
        if (!client) {
          console.error(`Client ${id} not found`);
          process.exit(1);
        }

        console.log('\nClient Details:');
        console.log('===============');
        console.log(`ID:           ${client.id}`);
        console.log(`Name:         ${client.name}`);
        console.log(`Email:        ${client.email || 'N/A'}`);
        console.log(`Phone:        ${client.phone || 'N/A'}`);
        console.log(`Phone 2:      ${client.phone2 || 'N/A'}`);
        console.log(`Address:      ${client.address || 'N/A'}`);
        console.log(`Type:         ${client.type}`);
        console.log(`Status:       ${client.status}`);
        console.log(`Stage:        ${client.pipelineStage}`);
        console.log(`Urgency:      ${client.urgency}`);
        console.log(`Source:       ${client.source || 'N/A'}`);
        console.log(`Budget:       ${formatCurrency(client.budgetMin)} - ${formatCurrency(client.budgetMax)}`);
        console.log(`Timeline:     ${client.timeline || 'N/A'}`);
        console.log(`Follow-up:    ${client.followUpDate || 'None'}`);
        console.log(`Created:      ${formatDate(client.createdAt)}`);
        console.log(`Updated:      ${formatDate(client.updatedAt)}`);
        console.log(`\nNotes:\n${client.notes || 'None'}`);

        // Show preferences
        const prefs = await skill.getPreferences(id);
        if (prefs) {
          console.log('\nProperty Preferences:');
          console.log('=====================');
          console.log(`Price Range:  ${formatCurrency(prefs.minPrice)} - ${formatCurrency(prefs.maxPrice)}`);
          console.log(`Bedrooms:     ${prefs.minBedrooms || 'Any'} - ${prefs.maxBedrooms || 'Any'}`);
          console.log(`Bathrooms:    ${prefs.minBathrooms || 'Any'} - ${prefs.maxBathrooms || 'Any'}`);
          console.log(`Sqft:         ${prefs.minSqft || 'Any'} - ${prefs.maxSqft || 'Any'}`);
          console.log(`Locations:    ${prefs.locations.join(', ') || 'Any'}`);
          console.log(`Types:        ${prefs.propertyTypes.join(', ') || 'Any'}`);
          console.log(`Must-have:    ${prefs.mustHaveFeatures.join(', ') || 'None'}`);
          console.log(`Nice-to-have: ${prefs.niceToHaveFeatures.join(', ') || 'None'}`);
        }
        break;
      }

      case 'update': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const updates: any = {};
        const name = args.find((_, i) => args[i - 1] === '--name');
        const email = args.find((_, i) => args[i - 1] === '--email');
        const phone = args.find((_, i) => args[i - 1] === '--phone');
        const phone2 = args.find((_, i) => args[i - 1] === '--phone2');
        const address = args.find((_, i) => args[i - 1] === '--address');
        const type = args.find((_, i) => args[i - 1] === '--type') as ClientType;
        const status = args.find((_, i) => args[i - 1] === '--status') as ClientStatus;
        const urgency = args.find((_, i) => args[i - 1] === '--urgency') as UrgencyLevel;
        const source = args.find((_, i) => args[i - 1] === '--source');
        const budgetMin = args.find((_, i) => args[i - 1] === '--budget-min');
        const budgetMax = args.find((_, i) => args[i - 1] === '--budget-max');
        const timeline = args.find((_, i) => args[i - 1] === '--timeline');
        const notes = args.find((_, i) => args[i - 1] === '--notes');

        if (name) updates.name = name;
        if (email !== undefined) updates.email = email || undefined;
        if (phone !== undefined) updates.phone = phone || undefined;
        if (phone2 !== undefined) updates.phone2 = phone2 || undefined;
        if (address !== undefined) updates.address = address || undefined;
        if (type) updates.type = type;
        if (status) updates.status = status;
        if (urgency) updates.urgency = urgency;
        if (source !== undefined) updates.source = source || undefined;
        if (budgetMin) updates.budgetMin = parseFloat(budgetMin);
        if (budgetMax) updates.budgetMax = parseFloat(budgetMax);
        if (timeline !== undefined) updates.timeline = timeline || undefined;
        if (notes !== undefined) updates.notes = notes || undefined;

        const client = await skill.updateClient(id, updates);
        if (!client) {
          console.error(`Client ${id} not found`);
          process.exit(1);
        }

        console.log(`✓ Client ${id} updated successfully`);
        break;
      }

      case 'delete': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const success = await skill.deleteClient(id);
        if (!success) {
          console.error(`Client ${id} not found`);
          process.exit(1);
        }

        console.log(`✓ Client ${id} deleted successfully`);
        break;
      }

      case 'search': {
        const query = args[1];
        if (!query) {
          console.error('Error: Search query required');
          process.exit(1);
        }

        const clients = await skill.searchClients(query);
        
        if (clients.length === 0) {
          console.log('No clients found.');
          break;
        }

        console.log(`\nFound ${clients.length} client(s) matching "${query}":\n`);
        for (const c of clients) {
          console.log(`${c.id}: ${c.name} (${c.type}, ${c.pipelineStage})`);
        }
        break;
      }

      case 'pipeline': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const stage = args.find((_, i) => args[i - 1] === '--stage') as PipelineStage;
        if (!stage) {
          console.error('Error: --stage is required');
          process.exit(1);
        }

        const client = await skill.updatePipelineStage(id, stage);
        if (!client) {
          console.error(`Client ${id} not found`);
          process.exit(1);
        }

        console.log(`✓ Client ${id} moved to "${stage}" stage`);
        break;
      }

      case 'pipeline-list': {
        const stats = await skill.getPipelineStats();
        
        console.log('\nPipeline Statistics:');
        console.log('====================');
        console.log('Stage           | Count | Total Value');
        console.log('----------------|-------|------------');
        
        let totalCount = 0;
        let totalValue = 0;
        
        for (const s of stats) {
          console.log(`${s.stage.padEnd(15)} | ${String(s.count).padStart(5)} | ${formatCurrency(s.totalValue)}`);
          totalCount += s.count;
          totalValue += s.totalValue;
        }
        
        console.log('----------------|-------|------------');
        console.log(`${'TOTAL'.padEnd(15)} | ${String(totalCount).padStart(5)} | ${formatCurrency(totalValue)}`);
        break;
      }

      case 'preferences': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const minPrice = args.find((_, i) => args[i - 1] === '--min-price');
        const maxPrice = args.find((_, i) => args[i - 1] === '--max-price');
        const minBeds = args.find((_, i) => args[i - 1] === '--min-beds');
        const maxBeds = args.find((_, i) => args[i - 1] === '--max-beds');
        const minBaths = args.find((_, i) => args[i - 1] === '--min-baths');
        const maxBaths = args.find((_, i) => args[i - 1] === '--max-baths');
        const minSqft = args.find((_, i) => args[i - 1] === '--min-sqft');
        const maxSqft = args.find((_, i) => args[i - 1] === '--max-sqft');
        const locations = args.find((_, i) => args[i - 1] === '--locations');
        const types = args.find((_, i) => args[i - 1] === '--types');
        const mustHave = args.find((_, i) => args[i - 1] === '--must-have');
        const niceToHave = args.find((_, i) => args[i - 1] === '--nice-to-have');

        const prefs = await skill.setPreferences(id, {
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          minBedrooms: minBeds ? parseInt(minBeds) : undefined,
          maxBedrooms: maxBeds ? parseInt(maxBeds) : undefined,
          minBathrooms: minBaths ? parseFloat(minBaths) : undefined,
          maxBathrooms: maxBaths ? parseFloat(maxBaths) : undefined,
          minSqft: minSqft ? parseInt(minSqft) : undefined,
          maxSqft: maxSqft ? parseInt(maxSqft) : undefined,
          locations: locations ? locations.split(',').map(s => s.trim()) : undefined,
          propertyTypes: types ? types.split(',').map(s => s.trim()) : undefined,
          mustHaveFeatures: mustHave ? mustHave.split(',').map(s => s.trim()) : undefined,
          niceToHaveFeatures: niceToHave ? niceToHave.split(',').map(s => s.trim()) : undefined,
        });

        console.log(`✓ Preferences saved for client ${id}`);
        console.log(`  Price: ${formatCurrency(prefs.minPrice)} - ${formatCurrency(prefs.maxPrice)}`);
        console.log(`  Locations: ${prefs.locations.join(', ') || 'Any'}`);
        break;
      }

      case 'preferences-get': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const prefs = await skill.getPreferences(id);
        if (!prefs) {
          console.log('No preferences set for this client.');
          break;
        }

        console.log('\nProperty Preferences:');
        console.log('=====================');
        console.log(`Price Range:  ${formatCurrency(prefs.minPrice)} - ${formatCurrency(prefs.maxPrice)}`);
        console.log(`Bedrooms:     ${prefs.minBedrooms || 'Any'} - ${prefs.maxBedrooms || 'Any'}`);
        console.log(`Bathrooms:    ${prefs.minBathrooms || 'Any'} - ${prefs.maxBathrooms || 'Any'}`);
        console.log(`Sqft:         ${prefs.minSqft || 'Any'} - ${prefs.maxSqft || 'Any'}`);
        console.log(`Locations:    ${prefs.locations.join(', ') || 'Any'}`);
        console.log(`Types:        ${prefs.propertyTypes.join(', ') || 'Any'}`);
        console.log(`Must-have:    ${prefs.mustHaveFeatures.join(', ') || 'None'}`);
        console.log(`Nice-to-have: ${prefs.niceToHaveFeatures.join(', ') || 'None'}`);
        break;
      }

      case 'log': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const type = args.find((_, i) => args[i - 1] === '--type') as CommunicationType;
        const content = args.find((_, i) => args[i - 1] === '--content');
        const propertyId = args.find((_, i) => args[i - 1] === '--property');

        if (!content) {
          console.error('Error: --content is required');
          process.exit(1);
        }

        await skill.addCommunication(id, {
          type: type || 'note',
          content,
          propertyId,
        });

        console.log(`✓ Communication logged for client ${id}`);
        break;
      }

      case 'communications': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const logs = await skill.getCommunications(id);
        
        if (logs.length === 0) {
          console.log('No communication history.');
          break;
        }

        console.log(`\nCommunication History (${logs.length} entries):\n`);
        for (const log of logs) {
          console.log(`${formatDate(log.createdAt)} [${log.type.toUpperCase()}]`);
          console.log(`  ${log.content}`);
          if (log.propertyId) console.log(`  Property: ${log.propertyId}`);
          console.log('');
        }
        break;
      }

      case 'follow-ups': {
        const daysStr = args.find((_, i) => args[i - 1] === '--days');
        const days = daysStr ? parseInt(daysStr) : 7;

        const clients = await skill.getUpcomingFollowUps(days);
        
        if (clients.length === 0) {
          console.log(`No follow-ups scheduled in the next ${days} days.`);
          break;
        }

        console.log(`\nUpcoming Follow-ups (next ${days} days):\n`);
        console.log('Date       | Client              | Notes');
        console.log('-----------|---------------------|-------');
        
        for (const c of clients) {
          const date = formatDate(c.followUpDate);
          const name = c.name.substring(0, 19).padEnd(19);
          console.log(`${date} | ${name} | ${c.notes?.substring(0, 40) || 'N/A'}`);
        }
        break;
      }

      case 'set-follow-up': {
        const id = parseInt(args[1]);
        if (isNaN(id)) {
          console.error('Error: Invalid client ID');
          process.exit(1);
        }

        const date = args.find((_, i) => args[i - 1] === '--date');
        const notes = args.find((_, i) => args[i - 1] === '--notes');

        if (!date) {
          console.error('Error: --date is required (YYYY-MM-DD)');
          process.exit(1);
        }

        const client = await skill.setFollowUp(id, date, notes);
        if (!client) {
          console.error(`Client ${id} not found`);
          process.exit(1);
        }

        console.log(`✓ Follow-up set for ${client.name} on ${date}`);
        break;
      }

      case 'by-location': {
        const location = args[1];
        if (!location) {
          console.error('Error: Location required');
          process.exit(1);
        }

        const clients = await skill.findByLocation(location);
        
        if (clients.length === 0) {
          console.log(`No clients interested in "${location}".`);
          break;
        }

        console.log(`\nClients interested in "${location}":\n`);
        for (const c of clients) {
          console.log(`${c.id}: ${c.name} (${c.type}, ${c.pipelineStage})`);
        }
        break;
      }

      case 'by-feature': {
        const feature = args[1];
        if (!feature) {
          console.error('Error: Feature required');
          process.exit(1);
        }

        const clients = await skill.findByFeature(feature);
        
        if (clients.length === 0) {
          console.log(`No clients looking for "${feature}".`);
          break;
        }

        console.log(`\nClients looking for "${feature}":\n`);
        for (const c of clients) {
          console.log(`${c.id}: ${c.name} (${c.type}, ${c.pipelineStage})`);
        }
        break;
      }

      case 'export': {
        const filePath = args.find((_, i) => args[i - 1] === '--file') || './clients.csv';
        await skill.exportToCSV(filePath);
        console.log(`✓ Exported clients to ${filePath}`);
        break;
      }

      case 'import': {
        const filePath = args.find((_, i) => args[i - 1] === '--file') || './clients.csv';
        const result = await skill.importFromCSV(filePath);
        console.log(`✓ Imported ${result.imported} clients (${result.errors} errors)`);
        break;
      }

      case 'stats': {
        const stats = await skill.getStatistics();
        
        console.log('\nClient CRM Statistics:');
        console.log('======================');
        console.log(`Total Clients:      ${stats.totalClients}`);
        console.log(`Active Buyers:      ${stats.activeBuyers}`);
        console.log(`Active Sellers:     ${stats.activeSellers}`);
        console.log(`Urgent Follow-ups:  ${stats.urgentFollowUps}`);
        console.log(`Pipeline Value:     ${formatCurrency(stats.totalPipelineValue)}`);
        
        console.log('\nBy Type:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`);
        }
        
        console.log('\nBy Stage:');
        for (const [stage, count] of Object.entries(stats.byStage)) {
          console.log(`  ${stage}: ${count}`);
        }
        
        console.log('\nBy Status:');
        for (const [status, count] of Object.entries(stats.byStatus)) {
          console.log(`  ${status}: ${count}`);
        }
        break;
      }

      case 'health': {
        const health = await skill.healthCheck();
        console.log(`Status: ${health.status}`);
        console.log(`Message: ${health.message}`);
        process.exit(health.status === 'healthy' ? 0 : 1);
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
