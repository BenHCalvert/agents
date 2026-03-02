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
 * Disambiguate duplicate header names by appending _1, _2, etc.
 * Repeated "Comment" columns become "comment_1", "comment_2", etc.
 */
function disambiguateHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map(h => {
    const lower = h.toLowerCase().trim();
    const count = (counts.get(lower) || 0) + 1;
    counts.set(lower, count);
    return count > 1 ? `${lower}_${count}` : lower;
  });
}

/**
 * Parse CSV content into array of objects.
 * Handles duplicate column names by disambiguating them.
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const headers = disambiguateHeaders(parseCSVLine(lines[0]));

  // Track which raw header names had duplicates so we can consolidate them
  const duplicateGroups = new Map<string, string[]>();
  const seen = new Map<string, number>();
  for (const h of rawHeaders) {
    seen.set(h, (seen.get(h) || 0) + 1);
  }
  for (const [name, count] of seen) {
    if (count > 1) {
      const disambiguated = headers
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => h === name || h.startsWith(name + '_'))
        .map(({ h }) => h);
      duplicateGroups.set(name, disambiguated);
    }
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // For each group of duplicate columns, produce a consolidated key
    // e.g. comment_1..comment_N -> "comments_all" with non-empty values joined
    for (const [baseName, disambiguatedNames] of duplicateGroups) {
      const consolidatedKey = `${baseName}_all`;
      if (!(consolidatedKey in row)) {
        const parts = disambiguatedNames
          .map(dn => row[dn] || '')
          .filter(v => v.trim().length > 0);
        if (parts.length > 0) {
          row[consolidatedKey] = parts.join('\n---\n');
        }
      }
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Normalize column names to handle variations.
 * Tries exact match first across all candidates, then falls back to substring.
 */
function getColumnValue(row: Record<string, string>, possibleNames: string[]): string {
  // Pass 1: exact match (most precise)
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        return row[key] || '';
      }
    }
  }
  // Pass 2: substring match (fuzzy fallback)
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase().includes(lowerName)) {
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

  // Get comments: prefer the consolidated "comment_all" field from duplicate columns,
  // then fall back to "comments" (the pre-processed single column).
  const consolidatedComments = row['comment_all'] || '';
  const singleComments = getColumnValue(row, ['comments', 'comment', 'all comments']);
  const commentsStr = consolidatedComments || singleComments;
  if (commentsStr) {
    ticket.comments = commentsStr.split(/\n---\n|\n\n|\r\n\r\n/).filter(c => c.trim());
  }

  // Copy useful extra fields, skip the many disambiguated duplicate columns
  Object.keys(row).forEach(key => {
    if (!(key in ticket) && !/_\d+$/.test(key) && !key.endsWith('_all')) {
      ticket[key] = row[key];
    }
  });

  return ticket;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Jira exports dates as "DD/Mon/YY h:mm AM" or "DD/Mon/YY h:mm PM"
const JIRA_DATE_RE = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i;

/**
 * Parse date string to Date object.
 * Handles Jira's DD/Mon/YY h:mm AM/PM format as well as ISO and common formats.
 */
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Try Jira format first (most common in our exports): "27/Feb/26 2:51 PM"
  const jiraMatch = dateStr.trim().match(JIRA_DATE_RE);
  if (jiraMatch) {
    const day = parseInt(jiraMatch[1], 10);
    const month = MONTH_MAP[jiraMatch[2].toLowerCase()];
    let year = parseInt(jiraMatch[3], 10);
    if (year < 100) year += 2000; // 26 -> 2026
    let hours = parseInt(jiraMatch[4], 10);
    const minutes = parseInt(jiraMatch[5], 10);
    const ampm = jiraMatch[6]?.toUpperCase();

    if (month !== undefined) {
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return new Date(year, month, day, hours, minutes);
    }
  }
  
  // Try ISO format
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
 * Determine ticket type from filename, with fallback to a row's 'type' column.
 * Returns null if the filename is ambiguous and no column data is provided.
 */
function detectTypeFromFilename(filename: string): 'bug' | 'request' | null {
  const lower = filename.toLowerCase();
  if (lower.includes('bug')) return 'bug';
  if (lower.includes('request') || lower.includes('feature') || lower.includes('fr')) return 'request';
  return null;
}

/**
 * Determine ticket type from a CSV row's 'type' or 'issue type' column.
 */
function detectTypeFromRow(row: Record<string, string>): 'bug' | 'request' | null {
  const typeVal = getColumnValue(row, ['type', 'issue type', 'ticket type', 'issuetype']).toLowerCase();
  if (!typeVal) return null;
  if (typeVal.includes('bug') || typeVal.includes('defect') || typeVal.includes('error')) return 'bug';
  if (typeVal.includes('request') || typeVal.includes('feature') || typeVal.includes('story') || typeVal.includes('enhancement')) return 'request';
  return null;
}

/**
 * Deduplicate tickets by key, then by id. Last-seen wins (preserves most complete record).
 */
function deduplicateTickets(tickets: JiraTicket[]): JiraTicket[] {
  const seen = new Map<string, JiraTicket>();
  for (const ticket of tickets) {
    const dedupeKey = ticket.key || ticket.id;
    if (dedupeKey) {
      seen.set(dedupeKey, ticket);
    } else {
      // No stable key — keep as-is using title as approximate dedup
      seen.set(ticket.title || JSON.stringify(ticket), ticket);
    }
  }
  return Array.from(seen.values());
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

      const filenameType = detectTypeFromFilename(file);
      if (filenameType === null) {
        console.warn(`[csv-reader] Ambiguous filename "${file}" — will determine ticket type from row data (type/issue type column). Files named with "bug", "request", or "feature" are detected automatically.`);
      }

      for (const row of rows) {
        // Use filename type as default; fall back to row-level type column
        const rowType = filenameType ?? detectTypeFromRow(row) ?? 'request';
        const ticket = parseJiraTicket(row, rowType);
        if (ticket.id || ticket.key) {
          if (rowType === 'bug') {
            bugs.push(ticket);
          } else {
            requests.push(ticket);
          }
        }
      }
    }

    // Deduplicate within each category (handles re-exported or overlapping CSVs)
    const uniqueBugs = deduplicateTickets(bugs);
    const uniqueRequests = deduplicateTickets(requests);

    if (uniqueBugs.length !== bugs.length) {
      console.log(`[csv-reader] Deduplication removed ${bugs.length - uniqueBugs.length} duplicate bug tickets`);
    }
    if (uniqueRequests.length !== requests.length) {
      console.log(`[csv-reader] Deduplication removed ${requests.length - uniqueRequests.length} duplicate request tickets`);
    }

    return { bugs: uniqueBugs, requests: uniqueRequests };
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

