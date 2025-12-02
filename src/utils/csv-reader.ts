import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface JiraTicket {
  id: string;
  key: string;
  title: string;
  description: string;
  type: 'bug' | 'request';
  status: string;
  priority: string;
  customer?: string;
  account?: string;
  arr?: number;
  created: Date;
  updated: Date;
  comments: string[];
  [key: string]: any; // For additional CSV columns
}

export interface TicketGroup {
  week: string; // YYYY-WW format
  date: Date;
  bugs: JiraTicket[];
  requests: JiraTicket[];
}

export interface TrendData {
  currentWeek: TicketGroup;
  previousWeeks: TicketGroup[];
  bugTrend: number; // Percentage change
  requestTrend: number; // Percentage change
  totalTrend: number; // Percentage change
}

/**
 * Parse a CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim()); // Add last field

  return result;
}

/**
 * Parse CSV content into array of objects
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Normalize column names to handle variations
 */
function getColumnValue(row: Record<string, string>, possibleNames: string[]): string {
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName || key.toLowerCase().includes(lowerName)) {
        return row[key] || '';
      }
    }
  }
  return '';
}

/**
 * Parse a Jira ticket from CSV row
 */
export function parseJiraTicket(row: Record<string, string>, type: 'bug' | 'request'): JiraTicket {
  const ticket: JiraTicket = {
    id: getColumnValue(row, ['id', 'issue id', 'ticket id']) || '',
    key: getColumnValue(row, ['key', 'issue key', 'ticket key']) || '',
    title: getColumnValue(row, ['summary', 'title', 'subject', 'name']) || '',
    description: getColumnValue(row, ['description', 'body', 'details']) || '',
    type,
    status: getColumnValue(row, ['status', 'state']) || '',
    priority: getColumnValue(row, ['priority', 'severity']) || '',
    customer: getColumnValue(row, ['customer', 'customer name', 'account name', 'reporter']) || undefined,
    account: getColumnValue(row, ['account', 'company', 'organization']) || undefined,
    created: parseDate(getColumnValue(row, ['created', 'created date', 'date created', 'created at'])),
    updated: parseDate(getColumnValue(row, ['updated', 'updated date', 'date updated', 'updated at'])),
    comments: [],
  };

  // Try to parse ARR if available
  const arrStr = getColumnValue(row, ['arr', 'annual recurring revenue', 'revenue']);
  if (arrStr) {
    const arrNum = parseFloat(arrStr.replace(/[^0-9.]/g, ''));
    if (!isNaN(arrNum)) {
      ticket.arr = arrNum;
    }
  }

  // Try to get comments
  const commentsStr = getColumnValue(row, ['comments', 'comment', 'all comments']);
  if (commentsStr) {
    ticket.comments = commentsStr.split(/\n\n|\r\n\r\n/).filter(c => c.trim());
  }

  // Copy all other fields
  Object.keys(row).forEach(key => {
    if (!(key in ticket)) {
      ticket[key] = row[key];
    }
  });

  return ticket;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try common formats
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      return new Date(dateStr);
    }
  }

  return new Date();
}

/**
 * Get week identifier (YYYY-WW format)
 */
function getWeekIdentifier(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Read and parse CSV files from directory
 */
export async function readCSVFiles(dataDir: string): Promise<{ bugs: JiraTicket[]; requests: JiraTicket[] }> {
  try {
    const files = await readdir(dataDir);
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    const bugs: JiraTicket[] = [];
    const requests: JiraTicket[] = [];

    for (const file of csvFiles) {
      const filePath = join(dataDir, file);
      const content = await readFile(filePath, 'utf-8');
      const rows = parseCSV(content);

      // Determine type from filename
      const type: 'bug' | 'request' = file.toLowerCase().includes('bug') ? 'bug' : 'request';

      for (const row of rows) {
        const ticket = parseJiraTicket(row, type);
        if (ticket.id || ticket.key) {
          if (type === 'bug') {
            bugs.push(ticket);
          } else {
            requests.push(ticket);
          }
        }
      }
    }

    return { bugs, requests };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Data directory not found: ${dataDir}. Please create it and add CSV files.`);
    }
    throw error;
  }
}

/**
 * Group tickets by week
 */
export function groupTicketsByWeek(
  bugs: JiraTicket[],
  requests: JiraTicket[]
): TicketGroup[] {
  const groups = new Map<string, TicketGroup>();

  const addTicket = (ticket: JiraTicket) => {
    const week = getWeekIdentifier(ticket.created);
    if (!groups.has(week)) {
      groups.set(week, {
        week,
        date: ticket.created,
        bugs: [],
        requests: [],
      });
    }
    const group = groups.get(week)!;
    if (ticket.type === 'bug') {
      group.bugs.push(ticket);
    } else {
      group.requests.push(ticket);
    }
  };

  bugs.forEach(addTicket);
  requests.forEach(addTicket);

  // Sort by date (most recent first)
  return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Calculate trends comparing current week to previous weeks
 */
export function calculateTrends(
  groups: TicketGroup[],
  lookbackWeeks: number = 4
): TrendData | null {
  if (groups.length === 0) return null;

  // Sort by date (most recent first)
  const sorted = [...groups].sort((a, b) => b.date.getTime() - a.date.getTime());
  const currentWeek = sorted[0];
  const previousWeeks = sorted.slice(1, lookbackWeeks + 1);

  // Calculate averages for previous weeks
  const prevBugCount = previousWeeks.length > 0
    ? previousWeeks.reduce((sum, g) => sum + g.bugs.length, 0) / previousWeeks.length
    : 0;
  const prevRequestCount = previousWeeks.length > 0
    ? previousWeeks.reduce((sum, g) => sum + g.requests.length, 0) / previousWeeks.length
    : 0;
  const prevTotalCount = prevBugCount + prevRequestCount;

  // Calculate trends
  const currentBugCount = currentWeek.bugs.length;
  const currentRequestCount = currentWeek.requests.length;
  const currentTotalCount = currentBugCount + currentRequestCount;

  const bugTrend = prevBugCount > 0
    ? ((currentBugCount - prevBugCount) / prevBugCount) * 100
    : currentBugCount > 0 ? 100 : 0;
  
  const requestTrend = prevRequestCount > 0
    ? ((currentRequestCount - prevRequestCount) / prevRequestCount) * 100
    : currentRequestCount > 0 ? 100 : 0;
  
  const totalTrend = prevTotalCount > 0
    ? ((currentTotalCount - prevTotalCount) / prevTotalCount) * 100
    : currentTotalCount > 0 ? 100 : 0;

  return {
    currentWeek,
    previousWeeks,
    bugTrend,
    requestTrend,
    totalTrend,
  };
}

