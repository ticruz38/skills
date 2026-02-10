#!/usr/bin/env node
/**
 * Data Connector CLI
 * Command-line interface for data management with Google Sheets, Airtable, and CSV
 */

import { DataConnectorSkill, Connection, DataSourceType, Row } from './index';

const skill = new DataConnectorSkill();

function log(message: string): void {
  console.log(message);
}

function logError(message: string): void {
  console.error(`Error: ${message}`);
}

function formatJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ==================== Commands ====================

async function status(): Promise<void> {
  const health = await skill.healthCheck();
  log(`Health: ${health.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
  log(`Message: ${health.message}`);
  if (health.details) {
    log(`\nDetails:`);
    log(`  Database: ${health.details.database ? '✓' : '✗'}`);
    log(`  Google OAuth: ${health.details.googleOAuth ? '✓ Connected' : '✗ Not connected'}`);
    log(`  Airtable: ${health.details.airtable ? '✓ Configured' : '✗ Not configured'}`);
  }
}

async function list(): Promise<void> {
  const connections = await skill.listConnections();
  
  if (connections.length === 0) {
    log('No connections configured.');
    log('\nCreate one with: data-connector add <name> <type>');
    return;
  }
  
  log(`\n${'ID'.padEnd(4)} ${'Name'.padEnd(20)} ${'Type'.padEnd(15)} ${'Last Synced'.padEnd(20)}`);
  log('-'.repeat(65));
  
  connections.forEach(c => {
    const lastSync = c.lastSyncedAt 
      ? new Date(c.lastSyncedAt).toLocaleString() 
      : 'Never';
    log(`${String(c.id).padEnd(4)} ${truncate(c.name, 20).padEnd(20)} ${c.type.padEnd(15)} ${lastSync.padEnd(20)}`);
  });
}

async function add(name: string, type: string): Promise<void> {
  if (!name || !type) {
    logError('Usage: data-connector add <name> <type>');
    log('\nTypes: google-sheets, airtable, csv');
    return;
  }
  
  const validTypes: DataSourceType[] = ['google-sheets', 'airtable', 'csv'];
  if (!validTypes.includes(type as DataSourceType)) {
    logError(`Invalid type: ${type}`);
    log('Valid types: google-sheets, airtable, csv');
    return;
  }
  
  let config: any;
  
  switch (type) {
    case 'google-sheets':
      log('\nGoogle Sheets Configuration:');
      log('Enter spreadsheet ID (from URL):');
      const spreadsheetId = await prompt('> ');
      log('Enter sheet name (default: Sheet1):');
      const sheetName = await prompt('> ') || 'Sheet1';
      log('Enter range (default: A1:Z1000):');
      const range = await prompt('> ') || 'A1:Z1000';
      
      config = { spreadsheetId, sheetName, range, hasHeaderRow: true };
      break;
      
    case 'airtable':
      log('\nAirtable Configuration:');
      log('Enter base ID:');
      const baseId = await prompt('> ');
      log('Enter table name:');
      const tableName = await prompt('> ');
      log('Enter API key (or leave blank for env var):');
      const apiKey = await prompt('> ');
      
      config = { baseId, tableName };
      if (apiKey) config.apiKey = apiKey;
      break;
      
    case 'csv':
      log('\nCSV Configuration:');
      log('Enter file path:');
      const filePath = await prompt('> ');
      log('Enter delimiter (default: ,):');
      const delimiter = await prompt('> ') || ',';
      
      config = { filePath, delimiter, hasHeaderRow: true };
      break;
  }
  
  try {
    const connection = await skill.createConnection(name, type as DataSourceType, config);
    log(`\n✓ Connection created: ${connection.name} (ID: ${connection.id})`);
  } catch (e: any) {
    logError(e.message);
  }
}

async function get(idStr: string): Promise<void> {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    logError('Invalid ID');
    return;
  }
  
  const connection = await skill.getConnection(id);
  if (!connection) {
    logError(`Connection ${id} not found`);
    return;
  }
  
  log(formatJSON(connection));
}

async function remove(idStr: string): Promise<void> {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    logError('Invalid ID');
    return;
  }
  
  const success = await skill.deleteConnection(id);
  if (success) {
    log(`✓ Connection ${id} deleted`);
  } else {
    logError(`Connection ${id} not found`);
  }
}

async function sync(idStr?: string): Promise<void> {
  if (!idStr) {
    // Sync all connections
    const connections = await skill.listConnections();
    for (const conn of connections) {
      if (conn.id) {
        log(`Syncing ${conn.name}...`);
        try {
          const data = await skill.syncConnection(conn.id);
          log(`  ✓ Synced ${data.length} rows`);
        } catch (e: any) {
          log(`  ✗ Error: ${e.message}`);
        }
      }
    }
    return;
  }
  
  const id = parseInt(idStr);
  if (isNaN(id)) {
    logError('Invalid ID');
    return;
  }
  
  try {
    log(`Syncing connection ${id}...`);
    const data = await skill.syncConnection(id);
    log(`✓ Synced ${data.length} rows`);
  } catch (e: any) {
    logError(e.message);
  }
}

async function read(idStr: string): Promise<void> {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    logError('Invalid ID');
    return;
  }
  
  const connection = await skill.getConnection(id);
  if (!connection) {
    logError(`Connection ${id} not found`);
    return;
  }
  
  try {
    log(`Reading from ${connection.name}...\n`);
    const data = await skill.readFromSource(connection);
    
    if (data.length === 0) {
      log('No data found.');
      return;
    }
    
    // Show first 10 rows
    log(`Found ${data.length} rows. Showing first 10:\n`);
    
    // Get headers from first row (excluding internal fields)
    const firstRow = data[0];
    const headers = Object.keys(firstRow).filter(k => !k.startsWith('_'));
    
    // Calculate column widths
    const colWidths = headers.map(h => Math.min(Math.max(h.length, 15), 30));
    
    // Print headers
    log(headers.map((h, i) => truncate(h, colWidths[i]).padEnd(colWidths[i])).join(' | '));
    log(headers.map((_, i) => '-'.repeat(colWidths[i])).join('-+-'));
    
    // Print rows
    data.slice(0, 10).forEach(row => {
      const values = headers.map((h, i) => {
        const val = String(row[h] ?? '');
        return truncate(val, colWidths[i]).padEnd(colWidths[i]);
      });
      log(values.join(' | '));
    });
    
    if (data.length > 10) {
      log(`\n... and ${data.length - 10} more rows`);
    }
  } catch (e: any) {
    logError(e.message);
  }
}

async function write(idStr: string, filePath?: string): Promise<void> {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    logError('Invalid ID');
    return;
  }
  
  const connection = await skill.getConnection(id);
  if (!connection) {
    logError(`Connection ${id} not found`);
    return;
  }
  
  if (!filePath) {
    logError('Usage: data-connector write <id> <json-file>');
    return;
  }
  
  try {
    const fs = await import('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as Row[];
    
    log(`Writing ${data.length} rows to ${connection.name}...`);
    await skill.writeToSource(connection, data);
    log('✓ Write complete');
  } catch (e: any) {
    logError(e.message);
  }
}

async function cache(idStr?: string): Promise<void> {
  if (!idStr) {
    // Show all cached data
    const connections = await skill.listConnections();
    log(`\nCached Data:\n`);
    
    for (const conn of connections) {
      if (conn.id) {
        const cached = await skill.getCachedData(conn.id);
        const status = cached ? `${cached.length} rows` : 'Not cached';
        log(`  ${conn.name}: ${status}`);
      }
    }
    return;
  }
  
  const id = parseInt(idStr);
  if (isNaN(id)) {
    logError('Invalid ID');
    return;
  }
  
  const connection = await skill.getConnection(id);
  if (!connection) {
    logError(`Connection ${id} not found`);
    return;
  }
  
  const cached = await skill.getCachedData(id);
  if (!cached) {
    log(`No cached data for ${connection.name}`);
    return;
  }
  
  log(`Cached data for ${connection.name}: ${cached.length} rows`);
  log('\n' + formatJSON(cached.slice(0, 5)));
  if (cached.length > 5) {
    log(`\n... and ${cached.length - 5} more rows`);
  }
}

async function clearCache(idStr?: string): Promise<void> {
  let count: number;
  
  if (idStr) {
    const id = parseInt(idStr);
    if (isNaN(id)) {
      logError('Invalid ID');
      return;
    }
    count = await skill.clearCache(id);
  } else {
    count = await skill.clearCache();
  }
  
  log(`✓ Cleared cache (${count} entries)`);
}

async function importCSV(filePath: string, connectionName?: string): Promise<void> {
  if (!filePath) {
    logError('Usage: data-connector import <csv-file> [connection-name]');
    return;
  }
  
  try {
    const data = skill.readCSV({ filePath, hasHeaderRow: true });
    log(`✓ Read ${data.length} rows from ${filePath}`);
    
    if (connectionName) {
      const connection = await skill.getConnectionByName(connectionName);
      if (!connection) {
        logError(`Connection '${connectionName}' not found`);
        return;
      }
      
      await skill.writeToSource(connection, data);
      log(`✓ Written to ${connectionName}`);
    }
    
    // Also output to stdout as JSON
    log('\nData preview:');
    log(formatJSON(data.slice(0, 5)));
  } catch (e: any) {
    logError(e.message);
  }
}

async function exportCSV(connectionId: string, filePath: string): Promise<void> {
  if (!connectionId || !filePath) {
    logError('Usage: data-connector export <connection-id> <csv-file>');
    return;
  }
  
  const id = parseInt(connectionId);
  if (isNaN(id)) {
    logError('Invalid connection ID');
    return;
  }
  
  try {
    const connection = await skill.getConnection(id);
    if (!connection) {
      logError(`Connection ${id} not found`);
      return;
    }
    
    const data = await skill.readFromSource(connection);
    skill.writeCSV({ filePath, hasHeaderRow: true }, data);
    
    log(`✓ Exported ${data.length} rows to ${filePath}`);
  } catch (e: any) {
    logError(e.message);
  }
}

async function stats(): Promise<void> {
  const s = await skill.getStats();
  log(`\nData Connector Statistics:`);
  log(`  Total connections: ${s.connections}`);
  log(`  Cached connections: ${s.cachedConnections}`);
}

// ==================== Helper Functions ====================

function prompt(question: string): Promise<string> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ==================== Main ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'status':
        await status();
        break;
      case 'list':
      case 'ls':
        await list();
        break;
      case 'add':
        await add(args[1], args[2]);
        break;
      case 'get':
        await get(args[1]);
        break;
      case 'delete':
      case 'remove':
      case 'rm':
        await remove(args[1]);
        break;
      case 'sync':
        await sync(args[1]);
        break;
      case 'read':
        await read(args[1]);
        break;
      case 'write':
        await write(args[1], args[2]);
        break;
      case 'cache':
        await cache(args[1]);
        break;
      case 'clear-cache':
        await clearCache(args[1]);
        break;
      case 'import':
        await importCSV(args[1], args[2]);
        break;
      case 'export':
        await exportCSV(args[1], args[2]);
        break;
      case 'stats':
        await stats();
        break;
      case 'health':
        await status();
        break;
      default:
        log('Data Connector - Manage data from Google Sheets, Airtable, and CSV');
        log('');
        log('Usage: data-connector <command> [options]');
        log('');
        log('Commands:');
        log('  status, health          Check system health');
        log('  list, ls               List all connections');
        log('  add <name> <type>      Create a new connection (google-sheets|airtable|csv)');
        log('  get <id>               Get connection details');
        log('  delete <id>            Delete a connection');
        log('  sync [id]              Sync data from source (all if no ID)');
        log('  read <id>              Read data from source');
        log('  write <id> <file>      Write JSON data to source');
        log('  cache [id]             Show cached data');
        log('  clear-cache [id]       Clear cache');
        log('  import <file> [conn]   Import CSV file (optionally to connection)');
        log('  export <id> <file>     Export connection to CSV');
        log('  stats                  Show statistics');
        log('');
        log('Examples:');
        log('  data-connector add my-sheet google-sheets');
        log('  data-connector sync');
        log('  data-connector read 1');
        log('  data-connector import data.csv my-sheet');
        log('  data-connector export 1 output.csv');
    }
  } catch (e: any) {
    logError(e.message);
    process.exit(1);
  } finally {
    await skill.close();
  }
}

main();
