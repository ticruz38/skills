/**
 * Calendar Skill
 * Google Calendar integration example
 */

const { google } = require('googleapis');

class CalendarSkill {
  constructor() {
    this.name = 'calendar';
    this.calendar = null;
  }

  async init(config) {
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/oauth2callback'
    );

    oauth2Client.setCredentials({
      refresh_token: config.GOOGLE_REFRESH_TOKEN
    });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    this.calendarId = config.GOOGLE_CALENDAR_ID || 'primary';
    this.timezone = config.DEFAULT_TIMEZONE || 'UTC';

    // Test connection
    try {
      await this.calendar.calendarList.list();
      console.log('[Calendar] Connected to Google Calendar');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listEvents(days = 7) {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);

    const response = await this.calendar.events.list({
      calendarId: this.calendarId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items;
  }

  async createEvent(params) {
    const { title, start, end, attendees = [] } = params;
    
    const event = {
      summary: title,
      start: { dateTime: start, timeZone: this.timezone },
      end: { dateTime: end, timeZone: this.timezone },
      attendees: attendees.map(email => ({ email }))
    };

    const response = await this.calendar.events.insert({
      calendarId: this.calendarId,
      requestBody: event
    });

    return response.data;
  }

  async health() {
    try {
      await this.calendar.calendarList.get({ calendarId: this.calendarId });
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = CalendarSkill;
