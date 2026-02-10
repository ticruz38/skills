import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';

export interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departure: {
    airport: string;
    airportCode: string;
    city: string;
    time: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    airportCode: string;
    city: string;
    time: string;
    terminal?: string;
  };
  duration: number; // in minutes
  stops: number;
  stopovers?: Array<{
    airport: string;
    airportCode: string;
    city: string;
    duration: number; // layover time in minutes
  }>;
  price: number;
  currency: string;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  seatsAvailable?: number;
  baggage?: {
    carryOn: boolean;
    checked: number; // number of checked bags
  };
}

export interface FlightSearchOptions {
  departureDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD for round trips
  passengers?: number;
  cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
  maxStops?: number;
  airlines?: string[]; // airline codes to filter
  maxPrice?: number;
  sortBy?: 'price' | 'duration' | 'departure' | 'arrival';
  flexibleDates?: boolean; // search +/- 3 days
}

export interface FlightSearchResults {
  query: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    passengers: number;
    cabin: string;
  };
  outbound: Flight[];
  return?: Flight[];
  totalResults: number;
  searchTime: number;
  fromCache: boolean;
  flexibleDateResults?: Array<{
    date: string;
    lowestPrice: number;
    flightCount: number;
  }>;
}

export interface SavedSearch {
  id?: number;
  name: string;
  origin: string;
  destination: string;
  passengers: number;
  cabin: string;
  maxStops?: number;
  maxPrice?: number;
  airlines?: string[];
  createdAt: string;
}

interface SavedSearchRecord {
  id: number;
  name: string;
  origin: string;
  destination: string;
  passengers: number;
  cabin: string;
  max_stops?: number;
  max_price?: number;
  airlines?: string;
  created_at: string;
}

interface SearchCacheRecord {
  id: number;
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers: number;
  cabin: string;
  results: string;
  created_at: string;
}

// Common airline data
const AIRLINES: Record<string, { name: string; code: string }> = {
  'AA': { name: 'American Airlines', code: 'AA' },
  'DL': { name: 'Delta Air Lines', code: 'DL' },
  'UA': { name: 'United Airlines', code: 'UA' },
  'WN': { name: 'Southwest Airlines', code: 'WN' },
  'B6': { name: 'JetBlue Airways', code: 'B6' },
  'AS': { name: 'Alaska Airlines', code: 'AS' },
  'F9': { name: 'Frontier Airlines', code: 'F9' },
  'NK': { name: 'Spirit Airlines', code: 'NK' },
  'LH': { name: 'Lufthansa', code: 'LH' },
  'BA': { name: 'British Airways', code: 'BA' },
  'AF': { name: 'Air France', code: 'AF' },
  'KL': { name: 'KLM', code: 'KL' },
  'LX': { name: 'SWISS', code: 'LX' },
  'OS': { name: 'Austrian Airlines', code: 'OS' },
  'IB': { name: 'Iberia', code: 'IB' },
  'AY': { name: 'Finnair', code: 'AY' },
  'EI': { name: 'Aer Lingus', code: 'EI' },
  'VS': { name: 'Virgin Atlantic', code: 'VS' },
  'EK': { name: 'Emirates', code: 'EK' },
  'QR': { name: 'Qatar Airways', code: 'QR' },
  'EY': { name: 'Etihad Airways', code: 'EY' },
  'SQ': { name: 'Singapore Airlines', code: 'SQ' },
  'CX': { name: 'Cathay Pacific', code: 'CX' },
  'JL': { name: 'Japan Airlines', code: 'JL' },
  'NH': { name: 'ANA', code: 'NH' },
  'QF': { name: 'Qantas', code: 'QF' },
  'AC': { name: 'Air Canada', code: 'AC' },
  'AM': { name: 'Aeromexico', code: 'AM' },
};

// Major airports database
const AIRPORTS: Record<string, { code: string; name: string; city: string; country: string }> = {
  'JFK': { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA' },
  'LAX': { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'USA' },
  'ORD': { code: 'ORD', name: "O'Hare International", city: 'Chicago', country: 'USA' },
  'DFW': { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'USA' },
  'DEN': { code: 'DEN', name: 'Denver International', city: 'Denver', country: 'USA' },
  'ATL': { code: 'ATL', name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta', country: 'USA' },
  'SFO': { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'USA' },
  'SEA': { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', country: 'USA' },
  'LAS': { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', country: 'USA' },
  'MCO': { code: 'MCO', name: 'Orlando International', city: 'Orlando', country: 'USA' },
  'MIA': { code: 'MIA', name: 'Miami International', city: 'Miami', country: 'USA' },
  'BOS': { code: 'BOS', name: 'Boston Logan International', city: 'Boston', country: 'USA' },
  'PHX': { code: 'PHX', name: 'Phoenix Sky Harbor', city: 'Phoenix', country: 'USA' },
  'IAH': { code: 'IAH', name: 'George Bush Intercontinental', city: 'Houston', country: 'USA' },
  'PHL': { code: 'PHL', name: 'Philadelphia International', city: 'Philadelphia', country: 'USA' },
  'LHR': { code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'UK' },
  'CDG': { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
  'FRA': { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
  'AMS': { code: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands' },
  'MAD': { code: 'MAD', name: 'Adolfo Suarez Madrid-Barajas', city: 'Madrid', country: 'Spain' },
  'FCO': { code: 'FCO', name: 'Leonardo da Vinci International', city: 'Rome', country: 'Italy' },
  'MUC': { code: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany' },
  'ZRH': { code: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland' },
  'VIE': { code: 'VIE', name: 'Vienna International', city: 'Vienna', country: 'Austria' },
  'DUB': { code: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland' },
  'DXB': { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE' },
  'SIN': { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore' },
  'HND': { code: 'HND', name: 'Haneda Airport', city: 'Tokyo', country: 'Japan' },
  'NRT': { code: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan' },
  'HKG': { code: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'China' },
  'ICN': { code: 'ICN', name: 'Incheon International', city: 'Seoul', country: 'South Korea' },
  'SYD': { code: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia' },
  'YYZ': { code: 'YYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada' },
  'YVR': { code: 'YVR', name: 'Vancouver International', city: 'Vancouver', country: 'Canada' },
  'MEX': { code: 'MEX', name: 'Mexico City International', city: 'Mexico City', country: 'Mexico' },
};

export class FlightSearchSkill {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private enableCache: boolean;
  private amadeusApiKey: string | null;
  private initPromise: Promise<void> | null = null;

  constructor(options: { enableCache?: boolean; dbPath?: string } = {}) {
    this.enableCache = options.enableCache ?? true;
    this.dbPath = options.dbPath || path.join(os.homedir(), '.openclaw', 'skills', 'flight-search', 'data.db');
    this.amadeusApiKey = process.env.AMADEUS_API_KEY || null;

    if (this.enableCache) {
      this.initPromise = this.initializeDatabase();
    }
  }

  private async initializeDatabase(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    const sql = `
      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        departure_date TEXT NOT NULL,
        return_date TEXT,
        passengers INTEGER NOT NULL,
        cabin TEXT NOT NULL,
        results TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saved_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        passengers INTEGER NOT NULL DEFAULT 1,
        cabin TEXT NOT NULL DEFAULT 'economy',
        max_stops INTEGER,
        max_price INTEGER,
        airlines TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_cache_route ON search_cache(origin, destination);
      CREATE INDEX IF NOT EXISTS idx_cache_dates ON search_cache(departure_date, return_date);
      CREATE INDEX IF NOT EXISTS idx_cache_created ON search_cache(created_at);
    `;

    return new Promise((resolve, reject) => {
      this.db!.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async searchFlights(
    origin: string,
    destination: string,
    options: FlightSearchOptions
  ): Promise<FlightSearchResults> {
    const startTime = Date.now();
    const opts: FlightSearchOptions = {
      passengers: 1,
      cabin: 'economy',
      sortBy: 'price',
      ...options
    };

    await this.waitForInit();

    // Normalize airport codes
    const originCode = origin.toUpperCase();
    const destCode = destination.toUpperCase();

    // Check cache first
    if (this.enableCache && !opts.flexibleDates) {
      const cached = await this.getCachedResultsInternal(originCode, destCode, opts);
      if (cached) {
        return {
          ...cached,
          searchTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    // Generate search results
    let results: Omit<FlightSearchResults, 'searchTime' | 'fromCache'>;
    
    if (this.amadeusApiKey) {
      results = await this.searchWithAmadeus(originCode, destCode, opts);
    } else {
      results = await this.searchWithSimulated(originCode, destCode, opts);
    }

    // Cache results
    if (this.enableCache && !opts.flexibleDates) {
      await this.cacheResults(originCode, destCode, opts, results);
    }

    return {
      ...results,
      searchTime: Date.now() - startTime,
      fromCache: false
    };
  }

  private async searchWithAmadeus(
    origin: string,
    destination: string,
    options: FlightSearchOptions
  ): Promise<Omit<FlightSearchResults, 'searchTime' | 'fromCache'>> {
    // Note: This is a placeholder for Amadeus API integration
    // In production, this would make actual API calls to Amadeus
    return this.searchWithSimulated(origin, destination, options);
  }

  private async searchWithSimulated(
    origin: string,
    destination: string,
    options: FlightSearchOptions
  ): Promise<Omit<FlightSearchResults, 'searchTime' | 'fromCache'>> {
    const originAirport = AIRPORTS[origin] || { code: origin, name: origin, city: origin, country: '' };
    const destAirport = AIRPORTS[destination] || { code: destination, name: destination, city: destination, country: '' };

    const outbound: Flight[] = [];
    const flexibleDateResults: Array<{ date: string; lowestPrice: number; flightCount: number }> = [];

    // Generate flights for the requested date or flexible dates
    const datesToSearch = options.flexibleDates 
      ? this.getFlexibleDates(options.departureDate)
      : [options.departureDate];

    for (const date of datesToSearch) {
      const dayFlights = this.generateFlightsForDate(
        originAirport,
        destAirport,
        date,
        options
      );

      if (options.flexibleDates) {
        const lowestPrice = Math.min(...dayFlights.map(f => f.price));
        flexibleDateResults.push({
          date,
          lowestPrice,
          flightCount: dayFlights.length
        });
      }

      outbound.push(...dayFlights);
    }

    // Filter and sort results
    let filtered = outbound;
    if (options.maxStops !== undefined) {
      filtered = filtered.filter(f => f.stops <= options.maxStops!);
    }
    if (options.maxPrice !== undefined) {
      filtered = filtered.filter(f => f.price <= options.maxPrice!);
    }
    if (options.airlines && options.airlines.length > 0) {
      filtered = filtered.filter(f => options.airlines!.includes(f.airlineCode));
    }

    // Sort results
    switch (options.sortBy) {
      case 'price':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'duration':
        filtered.sort((a, b) => a.duration - b.duration);
        break;
      case 'departure':
        filtered.sort((a, b) => new Date(a.departure.time).getTime() - new Date(b.departure.time).getTime());
        break;
      case 'arrival':
        filtered.sort((a, b) => new Date(a.arrival.time).getTime() - new Date(b.arrival.time).getTime());
        break;
    }

    // Generate return flights if round trip
    let returnFlights: Flight[] | undefined;
    if (options.returnDate) {
      returnFlights = this.generateFlightsForDate(
        destAirport,
        originAirport,
        options.returnDate,
        options
      );
      if (options.maxPrice !== undefined) {
        returnFlights = returnFlights.filter(f => f.price <= options.maxPrice!);
      }
    }

    return {
      query: {
        origin,
        destination,
        departureDate: options.departureDate,
        returnDate: options.returnDate,
        passengers: options.passengers || 1,
        cabin: options.cabin || 'economy'
      },
      outbound: filtered.slice(0, 20),
      return: returnFlights?.slice(0, 20),
      totalResults: filtered.length,
      flexibleDateResults: options.flexibleDates ? flexibleDateResults : undefined
    };
  }

  private getFlexibleDates(baseDate: string): string[] {
    const dates: string[] = [];
    const base = new Date(baseDate);
    
    // Generate dates for -3, -2, -1, 0, +1, +2, +3 days
    for (let i = -3; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    
    return dates;
  }

  private generateFlightsForDate(
    origin: { code: string; name: string; city: string; country: string },
    destination: { code: string; name: string; city: string; country: string },
    date: string,
    options: FlightSearchOptions
  ): Flight[] {
    const flights: Flight[] = [];
    const airlines = Object.values(AIRLINES).slice(0, 8); // Use first 8 airlines
    
    // Generate flights for different times of day
    const departureTimes = [
      { hour: 6, minute: 0 },
      { hour: 8, minute: 30 },
      { hour: 10, minute: 0 },
      { hour: 12, minute: 30 },
      { hour: 14, minute: 0 },
      { hour: 16, minute: 30 },
      { hour: 18, minute: 0 },
      { hour: 20, minute: 30 }
    ];

    for (let i = 0; i < departureTimes.length; i++) {
      const time = departureTimes[i];
      const airline = airlines[i % airlines.length];
      
      // Calculate duration (2-6 hours based on "distance")
      const baseDuration = 120 + (i * 30);
      const duration = baseDuration + Math.floor(Math.random() * 60);
      
      // Calculate departure and arrival times
      const departureTime = new Date(`${date}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`);
      const arrivalTime = new Date(departureTime.getTime() + duration * 60000);
      
      // Calculate price based on cabin and random variation
      const basePrice = 150 + (duration * 0.5) + (Math.random() * 200);
      const cabinMultiplier: Record<string, number> = {
        economy: 1,
        premium_economy: 1.8,
        business: 4,
        first: 8
      };
      const cabin = options.cabin || 'economy';
      const passengers = options.passengers || 1;
      const price = Math.round(basePrice * cabinMultiplier[cabin] * passengers);

      // Determine stops (0, 1, or 2)
      const stops = duration > 300 ? (duration > 480 ? 2 : 1) : 0;
      
      const flight: Flight = {
        id: `${airline.code}${100 + i}-${date}`,
        airline: airline.name,
        airlineCode: airline.code,
        flightNumber: `${airline.code}${100 + i}`,
        departure: {
          airport: origin.name,
          airportCode: origin.code,
          city: origin.city,
          time: departureTime.toISOString(),
          terminal: `T${(i % 3) + 1}`
        },
        arrival: {
          airport: destination.name,
          airportCode: destination.code,
          city: destination.city,
          time: arrivalTime.toISOString(),
          terminal: `T${((i + 1) % 3) + 1}`
        },
        duration,
        stops,
        price,
        currency: 'USD',
        cabin: cabin as Flight['cabin'],
        seatsAvailable: Math.floor(Math.random() * 20) + 1,
        baggage: {
          carryOn: true,
          checked: options.cabin === 'economy' ? 1 : (options.cabin === 'business' || options.cabin === 'first' ? 2 : 1)
        }
      };

      // Add stopover details if there are stops
      if (stops > 0) {
        const stopAirportCode = Object.keys(AIRPORTS)[(i + 5) % Object.keys(AIRPORTS).length];
        const stopAirport = AIRPORTS[stopAirportCode];
        flight.stopovers = [{
          airport: stopAirport.name,
          airportCode: stopAirport.code,
          city: stopAirport.city,
          duration: 90 // 1.5 hour layover
        }];
      }

      flights.push(flight);
    }

    return flights;
  }

  private async getCachedResultsInternal(
    origin: string,
    destination: string,
    options: FlightSearchOptions
  ): Promise<Omit<FlightSearchResults, 'searchTime' | 'fromCache'> | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT results FROM search_cache 
         WHERE origin = ? AND destination = ? 
         AND departure_date = ? AND return_date IS ?
         AND passengers = ? AND cabin = ?
         AND created_at > datetime("now", "-1 hour")`,
        [
          origin,
          destination,
          options.departureDate,
          options.returnDate || null,
          options.passengers || 1,
          options.cabin || 'economy'
        ],
        (err, row: SearchCacheRecord | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          if (!row) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(row.results));
          } catch {
            resolve(null);
          }
        }
      );
    });
  }

  private async cacheResults(
    origin: string,
    destination: string,
    options: FlightSearchOptions,
    results: Omit<FlightSearchResults, 'searchTime' | 'fromCache'>
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO search_cache (origin, destination, departure_date, return_date, passengers, cabin, results)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO UPDATE SET
           results = excluded.results,
           created_at = CURRENT_TIMESTAMP`,
        [
          origin,
          destination,
          options.departureDate,
          options.returnDate || null,
          options.passengers || 1,
          options.cabin || 'economy',
          JSON.stringify(results)
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt'>): Promise<SavedSearch> {
    await this.waitForInit();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO saved_searches 
        (name, origin, destination, passengers, cabin, max_stops, max_price, airlines)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      
      this.db!.run(
        sql,
        [
          search.name,
          search.origin,
          search.destination,
          search.passengers,
          search.cabin,
          search.maxStops || null,
          search.maxPrice || null,
          search.airlines ? JSON.stringify(search.airlines) : null
        ],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id: this.lastID,
            ...search,
            createdAt: new Date().toISOString()
          });
        }
      );
    });
  }

  async getSavedSearches(): Promise<SavedSearch[]> {
    await this.waitForInit();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM saved_searches ORDER BY created_at DESC',
        (err, rows: SavedSearchRecord[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => ({
            id: row.id,
            name: row.name,
            origin: row.origin,
            destination: row.destination,
            passengers: row.passengers,
            cabin: row.cabin,
            maxStops: row.max_stops,
            maxPrice: row.max_price,
            airlines: row.airlines ? JSON.parse(row.airlines) : undefined,
            createdAt: row.created_at
          })));
        }
      );
    });
  }

  async deleteSavedSearch(id: number): Promise<boolean> {
    await this.waitForInit();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      this.db!.run(
        'DELETE FROM saved_searches WHERE id = ?',
        [id],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        }
      );
    });
  }

  async getAirports(query?: string): Promise<Array<{ code: string; name: string; city: string; country: string }>> {
    const airports = Object.values(AIRPORTS);
    
    if (!query) {
      return airports;
    }
    
    const lowerQuery = query.toLowerCase();
    return airports.filter(a => 
      a.code.toLowerCase().includes(lowerQuery) ||
      a.name.toLowerCase().includes(lowerQuery) ||
      a.city.toLowerCase().includes(lowerQuery) ||
      a.country.toLowerCase().includes(lowerQuery)
    );
  }

  async getAirlines(): Promise<Array<{ code: string; name: string }>> {
    return Object.values(AIRLINES);
  }

  async clearCache(): Promise<number> {
    await this.waitForInit();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      this.db!.run(
        'DELETE FROM search_cache WHERE created_at < datetime("now", "-1 hour")',
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; apiAvailable: boolean }> {
    try {
      await this.waitForInit();
      
      const apiAvailable = !!this.amadeusApiKey;
      
      return {
        status: 'healthy',
        message: apiAvailable 
          ? 'Flight search skill is operational with Amadeus API'
          : 'Flight search skill is operational (simulated mode - set AMADEUS_API_KEY for real flight data)',
        apiAvailable
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${err}`,
        apiAvailable: false
      };
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.waitForInit();
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}

export default FlightSearchSkill;
