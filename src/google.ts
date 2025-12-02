import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Simple helper functions for Google APIs (Gmail and Calendar)
 */

let authClient: ReturnType<typeof google.auth.fromJSON> | null = null;

/**
 * Initialize Google OAuth2 client with credentials from .env
 */
export function initGoogleAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Set credentials from .env if available
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!refreshToken || refreshToken.trim() === '') {
    throw new Error(
      'GOOGLE_REFRESH_TOKEN is required in .env file.\n' +
      'Run "npm run get-google-token" to get your refresh token.'
    );
  }

  // Set credentials - refresh token is required, access token is optional (will be refreshed)
  const credentials: { refresh_token: string; access_token?: string } = {
    refresh_token: refreshToken,
  };

  if (accessToken && accessToken.trim() !== '') {
    credentials.access_token = accessToken;
  }

  oauth2Client.setCredentials(credentials);

  return oauth2Client;
}

/**
 * Get Gmail API client
 */
export async function getGmailClient() {
  const auth = initGoogleAuth();
  return google.gmail({ version: 'v1', auth });
}

/**
 * Get Google Calendar API client
 */
export async function getCalendarClient() {
  const auth = initGoogleAuth();
  return google.calendar({ version: 'v3', auth });
}

/**
 * Helper to read emails (simplified - returns message list)
 */
export async function readEmails(maxResults: number = 10) {
  const gmail = await getGmailClient();
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
  });
  return response.data.messages || [];
}

/**
 * Helper to get calendar events
 */
export async function getCalendarEvents(maxResults: number = 10) {
  const calendar = await getCalendarClient();
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return response.data.items || [];
}

