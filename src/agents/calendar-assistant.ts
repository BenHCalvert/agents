import { BaseAgent } from '../BaseAgent.js';
import { GeminiClient } from '../GeminiClient.js';
import { getCalendarEvents } from '../google.js';
import { SYSTEM_INSTRUCTION, buildPrompt } from './prompts/calendar-assistant.js';

/**
 * Calendar Assistant Agent
 * 
 * Acts as a chief of staff by analyzing your calendar to:
 * - Ensure you're spending time on the most important things
 * - Identify meetings that should be delegated
 * - Check that all meetings have conferencing links or locations
 */
export class CalendarAssistantAgent extends BaseAgent {
  name = 'calendar-assistant';
  description = 'Analyzes your calendar as a chief of staff to optimize your time and ensure meeting details are complete';

  private gemini: GeminiClient;

  constructor() {
    super();
    this.gemini = new GeminiClient();
  }

  async run(): Promise<void> {
    this.log('Starting calendar analysis...');

    try {
      // Fetch upcoming calendar events for the next week
      this.log('Fetching calendar events for the next week...');
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      const events = await getCalendarEvents(oneWeekFromNow.toISOString());

      if (events.length === 0) {
        this.log('No upcoming calendar events found.');
        return;
      }

      this.log(`Found ${events.length} upcoming events`);

      // Format events for analysis
      const formattedEvents = events.map((event: any) => ({
        id: event.id,
        summary: event.summary || '(No title)',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location || null,
        description: event.description || null,
        attendees: event.attendees?.map((a: any) => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })) || [],
        hangoutLink: event.hangoutLink || null,
        conferenceData: event.conferenceData ? 'Has conference link' : null,
      }));

      // Analyze with Gemini
      const prompt = buildPrompt(formattedEvents);

      this.log('Analyzing calendar with Gemini...');
      const analysis = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);

      this.log('\n=== Calendar Analysis ===');
      console.log(analysis);
      this.log('=== End of Analysis ===\n');

      // Check for missing links/locations
      const missingDetails = formattedEvents.filter((event: any) => {
        const hasLocation = !!event.location;
        const hasLink = !!event.hangoutLink || !!event.conferenceData;
        return !hasLocation && !hasLink;
      });

      if (missingDetails.length > 0) {
        this.log(`\n⚠️  Found ${missingDetails.length} meetings without location or conferencing link:`);
        missingDetails.forEach((event: any) => {
          console.log(`  - ${event.summary} (${event.start})`);
        });
      }

    } catch (error) {
      if (error instanceof Error && error.message.includes('GOOGLE_CLIENT_ID')) {
        this.error('Google OAuth credentials not configured. Please set up GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
        this.log('See README for instructions on setting up Google OAuth.');
      } else {
        this.error('Failed to analyze calendar', error);
      }
      throw error;
    }
  }
}

