#!/usr/bin/env node

import { FlightSearchSkill, Flight, FlightSearchOptions, SavedSearch } from './index';

const skill = new FlightSearchSkill();

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(price);
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function printFlight(flight: Flight, index: number): void {
  console.log(`\n  ${index}. ${flight.airline} ${flight.flightNumber}`);
  console.log(`     ${formatTime(flight.departure.time)} ${flight.departure.airportCode} → ${formatTime(flight.arrival.time)} ${flight.arrival.airportCode}`);
  console.log(`     Duration: ${formatDuration(flight.duration)} | Stops: ${flight.stops}${flight.stops > 0 ? ' (' + flight.stopovers?.map(s => s.airportCode).join(', ') + ')' : ''}`);
  console.log(`     Price: ${formatPrice(flight.price, flight.currency)}`);
  console.log(`     Cabin: ${flight.cabin}${flight.seatsAvailable !== undefined ? ` | Seats: ${flight.seatsAvailable}` : ''}`);
}

async function searchCommand(args: string[]): Promise<void> {
  const origin = args[0];
  const destination = args[1];
  const date = args[2];

  if (!origin || !destination || !date) {
    console.log('Usage: search <origin> <destination> <YYYY-MM-DD> [options]');
    console.log('Options:');
    console.log('  --return-date <YYYY-MM-DD>  Round trip date');
    console.log('  --passengers <n>            Number of passengers (default: 1)');
    console.log('  --cabin <type>              economy|premium_economy|business|first');
    console.log('  --max-stops <n>             Maximum stops');
    console.log('  --max-price <n>             Maximum price');
    console.log('  --airlines <AA,DL,UA>       Filter by airline codes');
    console.log('  --sort-by <field>           price|duration|departure|arrival');
    console.log('  --flexible                  Search +/- 3 days');
    return;
  }

  const options: FlightSearchOptions = {
    departureDate: date,
    passengers: 1,
    cabin: 'economy',
    sortBy: 'price'
  };

  // Parse additional options
  for (let i = 3; i < args.length; i++) {
    switch (args[i]) {
      case '--return-date':
        options.returnDate = args[++i];
        break;
      case '--passengers':
        options.passengers = parseInt(args[++i], 10);
        break;
      case '--cabin':
        options.cabin = args[++i] as FlightSearchOptions['cabin'];
        break;
      case '--max-stops':
        options.maxStops = parseInt(args[++i], 10);
        break;
      case '--max-price':
        options.maxPrice = parseInt(args[++i], 10);
        break;
      case '--airlines':
        options.airlines = args[++i].split(',').map(a => a.trim().toUpperCase());
        break;
      case '--sort-by':
        options.sortBy = args[++i] as FlightSearchOptions['sortBy'];
        break;
      case '--flexible':
        options.flexibleDates = true;
        break;
    }
  }

  console.log(`Searching flights from ${origin.toUpperCase()} to ${destination.toUpperCase()} on ${date}...`);
  
  try {
    const results = await skill.searchFlights(origin, destination, options);
    
    console.log(`\nFound ${results.totalResults} flights (took ${results.searchTime}ms${results.fromCache ? ', cached' : ''})`);
    
    // Show flexible date results if available
    if (results.flexibleDateResults && results.flexibleDateResults.length > 0) {
      console.log('\n📅 Flexible Date Prices:');
      results.flexibleDateResults.forEach(day => {
        const marker = day.date === options.departureDate ? '★' : ' ';
        console.log(`  ${marker} ${day.date}: ${formatPrice(day.lowestPrice, 'USD')} (${day.flightCount} flights)`);
      });
    }

    // Show outbound flights
    console.log('\n✈️  Outbound Flights:');
    if (results.outbound.length === 0) {
      console.log('  No flights found matching your criteria.');
    } else {
      results.outbound.forEach((flight, i) => printFlight(flight, i + 1));
    }

    // Show return flights if round trip
    if (results.return && results.return.length > 0) {
      console.log('\n🔄 Return Flights:');
      results.return.forEach((flight, i) => printFlight(flight, i + 1));
    }

    // Show search links for real booking
    console.log('\n🔗 Book flights at:');
    console.log(`  Google Flights: https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${destination}%20on%20${date}`);
    console.log(`  Kayak: https://www.kayak.com/flights/${origin}-${destination}/${date.replace(/-/g, '')}`);
    console.log(`  Expedia: https://www.expedia.com/Flights-Search?leg1=from:${origin},to:${destination},departure:${date}`);
  } catch (err) {
    console.error('Error searching flights:', err);
  }
}

async function airportsCommand(args: string[]): Promise<void> {
  const query = args[0];
  
  console.log(query ? `Searching airports for "${query}"...` : 'Listing all airports...');
  
  try {
    const airports = await skill.getAirports(query);
    
    console.log(`\nFound ${airports.length} airports:`);
    airports.forEach(a => {
      console.log(`  ${a.code} - ${a.name} (${a.city}, ${a.country})`);
    });
  } catch (err) {
    console.error('Error listing airports:', err);
  }
}

async function airlinesCommand(): Promise<void> {
  try {
    const airlines = await skill.getAirlines();
    
    console.log(`\nAvailable Airlines (${airlines.length}):`);
    airlines.forEach(a => {
      console.log(`  ${a.code} - ${a.name}`);
    });
  } catch (err) {
    console.error('Error listing airlines:', err);
  }
}

async function saveCommand(args: string[]): Promise<void> {
  if (args.length < 4) {
    console.log('Usage: save <name> <origin> <destination> [options]');
    console.log('Options:');
    console.log('  --passengers <n>      Number of passengers (default: 1)');
    console.log('  --cabin <type>        economy|premium_economy|business|first');
    console.log('  --max-stops <n>       Maximum stops');
    console.log('  --max-price <n>       Maximum price');
    console.log('  --airlines <AA,DL>    Preferred airlines');
    return;
  }

  const search: Omit<SavedSearch, 'id' | 'createdAt'> = {
    name: args[0],
    origin: args[1].toUpperCase(),
    destination: args[2].toUpperCase(),
    passengers: 1,
    cabin: 'economy'
  };

  // Parse options
  for (let i = 3; i < args.length; i++) {
    switch (args[i]) {
      case '--passengers':
        search.passengers = parseInt(args[++i], 10);
        break;
      case '--cabin':
        search.cabin = args[++i];
        break;
      case '--max-stops':
        search.maxStops = parseInt(args[++i], 10);
        break;
      case '--max-price':
        search.maxPrice = parseInt(args[++i], 10);
        break;
      case '--airlines':
        search.airlines = args[++i].split(',').map(a => a.trim().toUpperCase());
        break;
    }
  }

  try {
    const saved = await skill.saveSearch(search);
    console.log(`Saved search "${saved.name}" (ID: ${saved.id})`);
    console.log(`  ${saved.origin} → ${saved.destination}`);
    console.log(`  ${saved.passengers} passenger(s), ${saved.cabin}`);
  } catch (err) {
    console.error('Error saving search:', err);
  }
}

async function savedCommand(): Promise<void> {
  try {
    const searches = await skill.getSavedSearches();
    
    if (searches.length === 0) {
      console.log('No saved searches.');
      return;
    }

    console.log(`\nSaved Searches (${searches.length}):`);
    searches.forEach((s, i) => {
      console.log(`\n  ${i + 1}. ${s.name} (ID: ${s.id})`);
      console.log(`     Route: ${s.origin} → ${s.destination}`);
      console.log(`     Passengers: ${s.passengers}, Cabin: ${s.cabin}`);
      if (s.maxStops !== undefined) console.log(`     Max Stops: ${s.maxStops}`);
      if (s.maxPrice !== undefined) console.log(`     Max Price: $${s.maxPrice}`);
      if (s.airlines) console.log(`     Airlines: ${s.airlines.join(', ')}`);
    });
  } catch (err) {
    console.error('Error listing saved searches:', err);
  }
}

async function deleteSavedCommand(args: string[]): Promise<void> {
  const id = parseInt(args[0], 10);
  
  if (isNaN(id)) {
    console.log('Usage: delete-saved <id>');
    return;
  }

  try {
    const deleted = await skill.deleteSavedSearch(id);
    if (deleted) {
      console.log(`Deleted saved search ${id}.`);
    } else {
      console.log(`Saved search ${id} not found.`);
    }
  } catch (err) {
    console.error('Error deleting saved search:', err);
  }
}

async function statusCommand(): Promise<void> {
  try {
    const health = await skill.healthCheck();
    
    console.log('Flight Search Skill Status');
    console.log('==========================');
    console.log(`Status: ${health.status}`);
    console.log(`Message: ${health.message}`);
    console.log(`API Available: ${health.apiAvailable ? 'Yes' : 'No'}`);
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

async function healthCommand(): Promise<void> {
  await statusCommand();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'search':
        await searchCommand(args.slice(1));
        break;
      case 'airports':
        await airportsCommand(args.slice(1));
        break;
      case 'airlines':
        await airlinesCommand();
        break;
      case 'save':
        await saveCommand(args.slice(1));
        break;
      case 'saved':
        await savedCommand();
        break;
      case 'delete-saved':
        await deleteSavedCommand(args.slice(1));
        break;
      case 'status':
        await statusCommand();
        break;
      case 'health':
        await healthCommand();
        break;
      case 'help':
      default:
        console.log('Flight Search Skill CLI');
        console.log('======================');
        console.log('Commands:');
        console.log('  search <origin> <destination> <YYYY-MM-DD>  Search for flights');
        console.log('  airports [query]                            List/search airports');
        console.log('  airlines                                    List available airlines');
        console.log('  save <name> <origin> <destination>          Save a search configuration');
        console.log('  saved                                       List saved searches');
        console.log('  delete-saved <id>                           Delete a saved search');
        console.log('  status/health                               Check system status');
        console.log('  help                                        Show this help');
        console.log('');
        console.log('Examples:');
        console.log('  search JFK LAX 2024-03-15');
        console.log('  search JFK LHR 2024-03-15 --cabin business --max-stops 1');
        console.log('  search JFK LAX 2024-03-15 --return-date 2024-03-22 --flexible');
        console.log('  save "NYC to LA" JFK LAX --cabin business');
    }
  } finally {
    await skill.close();
  }
}

main().catch(console.error);
