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
 * @param timeMax - Optional end date/time (ISO string). If not provided, fetches all future events up to maxResults
 * @param maxResults - Maximum number of results (default: 250)
 */
export async function getCalendarEvents(timeMax?: string, maxResults: number = 250) {
  const calendar = await getCalendarClient();
  const params: any = {
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  };
  
  if (timeMax) {
    params.timeMax = timeMax;
  }
  
  const response = await calendar.events.list(params);
  return response.data.items || [];
}

/**
 * Get full email content including headers and body
 */
export async function getEmailContent(messageId: string) {
  const gmail = await getGmailClient();
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return response.data;
}

/**
 * Parse email body from Gmail message format
 */
export function parseEmailBody(message: any): { text: string; html: string } {
  let text = '';
  let html = '';

  const getBody = (part: any): void => {
    if (part.body?.data) {
      const data = part.body.data;
      const decoded = Buffer.from(data, 'base64').toString('utf-8');
      if (part.mimeType === 'text/plain') {
        text = decoded;
      } else if (part.mimeType === 'text/html') {
        html = decoded;
      }
    }

    if (part.parts) {
      part.parts.forEach((p: any) => getBody(p));
    }
  };

  if (message.payload) {
    getBody(message.payload);
  }

  return { text, html };
}

/**
 * Get email headers as a simple object
 */
export function getEmailHeaders(message: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (message.payload?.headers) {
    message.payload.headers.forEach((h: any) => {
      headers[h.name.toLowerCase()] = h.value;
    });
  }
  return headers;
}

/**
 * Archive an email (remove from inbox)
 */
export async function archiveEmail(messageId: string) {
  const gmail = await getGmailClient();
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['INBOX'],
    },
  });
}

/**
 * Apply a label to an email
 */
export async function labelEmail(messageId: string, labelId: string) {
  const gmail = await getGmailClient();
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
    },
  });
}

/**
 * Get or create a Gmail label
 */
export async function getOrCreateLabel(labelName: string): Promise<string> {
  const gmail = await getGmailClient();
  
  // First, try to find existing label
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const existingLabel = labelsResponse.data.labels?.find(
    (label) => label.name?.toLowerCase() === labelName.toLowerCase()
  );
  
  if (existingLabel?.id) {
    return existingLabel.id;
  }
  
  // Create new label if it doesn't exist
  const createResponse = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });
  
  return createResponse.data.id || '';
}

/**
 * Get all Gmail labels
 */
export async function getLabels() {
  const gmail = await getGmailClient();
  const response = await gmail.users.labels.list({ userId: 'me' });
  return response.data.labels || [];
}

/**
 * Create a Gmail draft
 */
export async function createDraft(
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  replyToMessageId?: string
) {
  const gmail = await getGmailClient();
  
  // Create the email message in RFC 2822 format
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    body,
  ].join('\n');
  
  // Encode the message in base64url format
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const draftBody: any = {
    message: {
      raw: encodedMessage,
    },
  };
  
  if (threadId) {
    draftBody.message.threadId = threadId;
  }
  
  if (replyToMessageId) {
    // Get the original message to set In-Reply-To and References headers
    const originalMessage = await getEmailContent(replyToMessageId);
    const headers = getEmailHeaders(originalMessage);
    const messageId = headers['message-id'];
    
    if (messageId) {
      const replyMessage = [
        `To: ${to}`,
        `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
        `In-Reply-To: ${messageId}`,
        `References: ${headers.references || ''} ${messageId}`.trim(),
        '',
        body,
      ].join('\n');
      
      const encodedReply = Buffer.from(replyMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      draftBody.message.raw = encodedReply;
      draftBody.message.threadId = originalMessage.threadId;
    }
  }
  
  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: draftBody,
  });
  
  return response.data;
}

/**
 * Get full email thread
 */
export async function getEmailThread(threadId: string) {
  const gmail = await getGmailClient();
  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });
  return response.data;
}

/**
 * Search emails using Gmail query syntax
 */
export async function searchEmails(query: string, maxResults: number = 50) {
  const gmail = await getGmailClient();
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  return response.data.messages || [];
}

