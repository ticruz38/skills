import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface Trip {
  id?: number;
  name: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id?: number;
  tripId: number;
  dayNumber: number; // Day 1, 2, 3, etc.
  title: string;
  description?: string;
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  duration?: number; // in minutes
  location?: string;
  address?: string;
  category: 'transport' | 'sightseeing' | 'food' | 'shopping' | 'entertainment' | 'relaxation' | 'accommodation' | 'other';
  cost?: number;
  currency?: string;
  notes?: string;
  bookingRef?: string;
  orderIndex: number; // for ordering within a day
}

export interface TripWithActivities extends Trip {
  activities: Activity[];
}

export interface DaySchedule {
  dayNumber: number;
  date: string;
  activities: Activity[];
}

export interface ItineraryExport {
  trip: Trip;
  days: DaySchedule[];
  summary: {
    totalDays: number;
    totalActivities: number;
    estimatedCost: number;
    categories: Record<string, number>;
  };
}

interface TripRecord {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ActivityRecord {
  id: number;
  trip_id: number;
  day_number: number;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  location?: string;
  address?: string;
  category: string;
  cost?: number;
  currency?: string;
  notes?: string;
  booking_ref?: string;
  order_index: number;
}

function runWithResult(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export class ItineraryBuilder {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const dataDir = path.join(os.homedir(), '.openclaw', 'skills', 'itinerary-builder');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'itineraries.db');
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      this.db = new (sqlite3 as any).Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(() => resolve()).catch(reject);
      });
    });
    
    return this.initPromise;
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tripsTable = `
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        destination TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    const activitiesTable = `
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT,
        end_time TEXT,
        duration INTEGER,
        location TEXT,
        address TEXT,
        category TEXT NOT NULL DEFAULT 'other',
        cost REAL,
        currency TEXT,
        notes TEXT,
        booking_ref TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      )
    `;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(tripsTable);
        this.db!.run(activitiesTable, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  // Trip management
  async createTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const result = await runWithResult(
      this.db,
      `INSERT INTO trips (name, destination, start_date, end_date, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [trip.name, trip.destination, trip.startDate, trip.endDate, trip.description || null, now, now]
    );

    return {
      id: result.lastID,
      ...trip,
      createdAt: now,
      updatedAt: now
    };
  }

  async getTrip(id: number): Promise<Trip | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get<TripRecord>(
        'SELECT * FROM trips WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else resolve(this.recordToTrip(row));
        }
      );
    });
  }

  async getTripWithActivities(id: number): Promise<TripWithActivities | null> {
    const trip = await this.getTrip(id);
    if (!trip) return null;

    const activities = await this.getActivitiesByTrip(id);
    return { ...trip, activities };
  }

  async listTrips(): Promise<Trip[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all<TripRecord>(
        'SELECT * FROM trips ORDER BY start_date DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve((rows || []).map(row => this.recordToTrip(row)));
        }
      );
    });
  }

  async updateTrip(id: number, updates: Partial<Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Trip | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.destination !== undefined) { sets.push('destination = ?'); values.push(updates.destination); }
    if (updates.startDate !== undefined) { sets.push('start_date = ?'); values.push(updates.startDate); }
    if (updates.endDate !== undefined) { sets.push('end_date = ?'); values.push(updates.endDate); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    
    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await runWithResult(
      this.db,
      `UPDATE trips SET ${sets.join(', ')} WHERE id = ?`,
      values
    );

    return this.getTrip(id);
  }

  async deleteTrip(id: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, 'DELETE FROM trips WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Activity management
  async addActivity(activity: Omit<Activity, 'id'>): Promise<Activity> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(
      this.db,
      `INSERT INTO activities (trip_id, day_number, title, description, start_time, end_time, duration,
        location, address, category, cost, currency, notes, booking_ref, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.tripId, activity.dayNumber, activity.title, activity.description || null,
        activity.startTime || null, activity.endTime || null, activity.duration || null,
        activity.location || null, activity.address || null, activity.category,
        activity.cost || null, activity.currency || null, activity.notes || null,
        activity.bookingRef || null, activity.orderIndex
      ]
    );

    return { id: result.lastID, ...activity };
  }

  async getActivity(id: number): Promise<Activity | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get<ActivityRecord>(
        'SELECT * FROM activities WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else resolve(this.recordToActivity(row));
        }
      );
    });
  }

  async getActivitiesByTrip(tripId: number): Promise<Activity[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all<ActivityRecord>(
        'SELECT * FROM activities WHERE trip_id = ? ORDER BY day_number, order_index, start_time',
        [tripId],
        (err, rows) => {
          if (err) reject(err);
          else resolve((rows || []).map(row => this.recordToActivity(row)));
        }
      );
    });
  }

  async updateActivity(id: number, updates: Partial<Omit<Activity, 'id' | 'tripId'>>): Promise<Activity | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.dayNumber !== undefined) { sets.push('day_number = ?'); values.push(updates.dayNumber); }
    if (updates.title !== undefined) { sets.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.startTime !== undefined) { sets.push('start_time = ?'); values.push(updates.startTime); }
    if (updates.endTime !== undefined) { sets.push('end_time = ?'); values.push(updates.endTime); }
    if (updates.duration !== undefined) { sets.push('duration = ?'); values.push(updates.duration); }
    if (updates.location !== undefined) { sets.push('location = ?'); values.push(updates.location); }
    if (updates.address !== undefined) { sets.push('address = ?'); values.push(updates.address); }
    if (updates.category !== undefined) { sets.push('category = ?'); values.push(updates.category); }
    if (updates.cost !== undefined) { sets.push('cost = ?'); values.push(updates.cost); }
    if (updates.currency !== undefined) { sets.push('currency = ?'); values.push(updates.currency); }
    if (updates.notes !== undefined) { sets.push('notes = ?'); values.push(updates.notes); }
    if (updates.bookingRef !== undefined) { sets.push('booking_ref = ?'); values.push(updates.bookingRef); }
    if (updates.orderIndex !== undefined) { sets.push('order_index = ?'); values.push(updates.orderIndex); }
    
    values.push(id);

    await runWithResult(
      this.db,
      `UPDATE activities SET ${sets.join(', ')} WHERE id = ?`,
      values
    );

    return this.getActivity(id);
  }

  async deleteActivity(id: number): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const result = await runWithResult(this.db, 'DELETE FROM activities WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Reorder activities within a day
  async reorderActivities(tripId: number, dayNumber: number, activityIds: number[]): Promise<boolean> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    for (let i = 0; i < activityIds.length; i++) {
      await runWithResult(
        this.db,
        'UPDATE activities SET order_index = ? WHERE id = ? AND trip_id = ? AND day_number = ?',
        [i, activityIds[i], tripId, dayNumber]
      );
    }
    return true;
  }

  // Move activity to different day
  async moveActivityToDay(activityId: number, newDayNumber: number, newOrderIndex?: number): Promise<Activity | null> {
    const activity = await this.getActivity(activityId);
    if (!activity) return null;

    const updates: Partial<Omit<Activity, 'id' | 'tripId'>> = { dayNumber: newDayNumber };
    if (newOrderIndex !== undefined) {
      updates.orderIndex = newOrderIndex;
    }

    return this.updateActivity(activityId, updates);
  }

  // Calculate travel time between activities (simple estimation)
  estimateTravelTime(fromActivity: Activity, toActivity: Activity): number {
    if (!fromActivity.location || !toActivity.location) {
      return 30; // Default 30 minutes if no location info
    }

    // Simple heuristic based on category
    if (fromActivity.category === 'accommodation' || toActivity.category === 'accommodation') {
      return 20; // Usually close to accommodation
    }
    if (fromActivity.category === 'transport' || toActivity.category === 'transport') {
      return 45; // Transport hubs may require more time
    }
    if (fromActivity.location === toActivity.location) {
      return 5; // Same location
    }

    return 30; // Default estimate
  }

  // Generate day-by-day schedule
  async generateSchedule(tripId: number): Promise<DaySchedule[]> {
    const trip = await this.getTrip(tripId);
    if (!trip) throw new Error('Trip not found');

    const activities = await this.getActivitiesByTrip(tripId);
    
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const days: DaySchedule[] = [];

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + (day - 1));
      
      const dayActivities = activities.filter(a => a.dayNumber === day);
      
      days.push({
        dayNumber: day,
        date: date.toISOString().split('T')[0],
        activities: dayActivities
      });
    }

    return days;
  }

  // Export itinerary
  async exportItinerary(tripId: number): Promise<ItineraryExport> {
    const tripWithActivities = await this.getTripWithActivities(tripId);
    if (!tripWithActivities) throw new Error('Trip not found');

    const days = await this.generateSchedule(tripId);
    
    // Calculate summary
    const totalActivities = tripWithActivities.activities.length;
    const categories: Record<string, number> = {};
    let estimatedCost = 0;

    for (const activity of tripWithActivities.activities) {
      categories[activity.category] = (categories[activity.category] || 0) + 1;
      if (activity.cost) {
        estimatedCost += activity.cost;
      }
    }

    return {
      trip: tripWithActivities,
      days,
      summary: {
        totalDays: days.length,
        totalActivities,
        estimatedCost,
        categories
      }
    };
  }

  // Generate HTML for PDF export
  generateHTML(itinerary: ItineraryExport): string {
    const { trip, days, summary } = itinerary;
    
    const formatTime = (time?: string) => time || 'TBD';
    const formatCurrency = (cost?: number, currency?: string) => {
      if (!cost) return '';
      return `${currency || 'USD'} ${cost.toFixed(2)}`;
    };

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${trip.name} - Itinerary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #4a90d9;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { color: #2c3e50; font-size: 32px; margin-bottom: 10px; }
    .header .destination { color: #7f8c8d; font-size: 18px; }
    .header .dates { color: #95a5a6; margin-top: 5px; }
    .summary {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .summary h2 { color: #2c3e50; margin-bottom: 15px; font-size: 20px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    .summary-item { text-align: center; }
    .summary-item .value { font-size: 24px; font-weight: bold; color: #4a90d9; }
    .summary-item .label { color: #7f8c8d; font-size: 14px; }
    .day {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .day-header {
      background: #4a90d9;
      color: white;
      padding: 15px 20px;
      border-radius: 8px 8px 0 0;
    }
    .day-header h3 { font-size: 18px; }
    .day-header .date { opacity: 0.9; font-size: 14px; }
    .activities { border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .activity {
      padding: 15px 20px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      gap: 15px;
    }
    .activity:last-child { border-bottom: none; }
    .activity-time {
      min-width: 100px;
      color: #4a90d9;
      font-weight: 600;
    }
    .activity-content { flex: 1; }
    .activity-title { font-weight: 600; color: #2c3e50; font-size: 16px; }
    .activity-location { color: #7f8c8d; font-size: 14px; margin-top: 3px; }
    .activity-description { color: #555; font-size: 14px; margin-top: 5px; }
    .activity-meta {
      display: flex;
      gap: 15px;
      margin-top: 8px;
      font-size: 13px;
    }
    .activity-category {
      background: #e8f4f8;
      color: #4a90d9;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .activity-cost { color: #27ae60; font-weight: 500; }
    .activity-notes { color: #95a5a6; font-style: italic; margin-top: 5px; }
    .no-activities {
      padding: 30px;
      text-align: center;
      color: #95a5a6;
      font-style: italic;
    }
    @media print {
      body { padding: 20px; }
      .day { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${trip.name}</h1>
    <div class="destination">${trip.destination}</div>
    <div class="dates">${trip.startDate} to ${trip.endDate}</div>
    ${trip.description ? `<p style="margin-top: 10px; color: #555;">${trip.description}</p>` : ''}
  </div>

  <div class="summary">
    <h2>Trip Summary</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="value">${summary.totalDays}</div>
        <div class="label">Days</div>
      </div>
      <div class="summary-item">
        <div class="value">${summary.totalActivities}</div>
        <div class="label">Activities</div>
      </div>
      <div class="summary-item">
        <div class="value">${formatCurrency(summary.estimatedCost, 'USD')}</div>
        <div class="label">Est. Cost</div>
      </div>
    </div>
  </div>
`;

    for (const day of days) {
      html += `
  <div class="day">
    <div class="day-header">
      <h3>Day ${day.dayNumber}</h3>
      <div class="date">${day.date}</div>
    </div>
    <div class="activities">
`;
      if (day.activities.length === 0) {
        html += `      <div class="no-activities">No activities planned for this day</div>\n`;
      } else {
        for (const activity of day.activities) {
          html += `      <div class="activity">
        <div class="activity-time">${formatTime(activity.startTime)}${activity.endTime ? ` - ${formatTime(activity.endTime)}` : ''}</div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          ${activity.location ? `<div class="activity-location">📍 ${activity.location}${activity.address ? ` - ${activity.address}` : ''}</div>` : ''}
          ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
          <div class="activity-meta">
            <span class="activity-category">${activity.category}</span>
            ${activity.cost ? `<span class="activity-cost">${formatCurrency(activity.cost, activity.currency)}</span>` : ''}
            ${activity.duration ? `<span>⏱️ ${activity.duration} min</span>` : ''}
          </div>
          ${activity.notes ? `<div class="activity-notes">${activity.notes}</div>` : ''}
          ${activity.bookingRef ? `<div class="activity-notes">Booking: ${activity.bookingRef}</div>` : ''}
        </div>
      </div>
`;
        }
      }
      html += `    </div>
  </div>
`;
    }

    html += `</body>
</html>`;
    return html;
  }

  async exportToHTML(tripId: number, filePath?: string): Promise<string> {
    const itinerary = await this.exportItinerary(tripId);
    const html = this.generateHTML(itinerary);
    
    const outputPath = filePath || path.join(
      os.homedir(), 
      '.openclaw', 
      'skills', 
      'itinerary-builder',
      `${itinerary.trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_itinerary.html`
    );
    
    fs.writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  }

  // Statistics
  async getStats(): Promise<{ totalTrips: number; totalActivities: number; upcomingTrips: number }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const today = new Date().toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      this.db!.get<{ totalTrips: number; totalActivities: number; upcomingTrips: number }>(
        `SELECT 
          (SELECT COUNT(*) FROM trips) as totalTrips,
          (SELECT COUNT(*) FROM activities) as totalActivities,
          (SELECT COUNT(*) FROM trips WHERE start_date >= ?) as upcomingTrips`,
        [today],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { totalTrips: 0, totalActivities: 0, upcomingTrips: 0 });
        }
      );
    });
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initialize();
      const stats = await this.getStats();
      return {
        healthy: true,
        message: `Healthy. ${stats.totalTrips} trips, ${stats.totalActivities} activities.`
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Close connection
  async close(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  private recordToTrip(record: TripRecord): Trip {
    return {
      id: record.id,
      name: record.name,
      destination: record.destination,
      startDate: record.start_date,
      endDate: record.end_date,
      description: record.description,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  private recordToActivity(record: ActivityRecord): Activity {
    return {
      id: record.id,
      tripId: record.trip_id,
      dayNumber: record.day_number,
      title: record.title,
      description: record.description,
      startTime: record.start_time,
      endTime: record.end_time,
      duration: record.duration,
      location: record.location,
      address: record.address,
      category: record.category as Activity['category'],
      cost: record.cost,
      currency: record.currency,
      notes: record.notes,
      bookingRef: record.booking_ref,
      orderIndex: record.order_index
    };
  }
}

export default ItineraryBuilder;
