/**
 * Prompts for the Customer Intelligence Agent
 */

import type { JiraTicket, TrendData } from '../../utils/csv-reader.js';

export const SYSTEM_INSTRUCTION = `You are an AI Customer Intelligence Analyst. Your role is to analyze customer feedback from support tickets, feature requests, and bug reports to identify patterns, quantify business impact, and inform product decisions.

Your analysis should be:
- Data-driven: Base insights on quantitative evidence
- Actionable: Provide clear, prioritized recommendations
- Business-focused: Connect feedback to revenue impact when possible
- Concise: Distill complex feedback into clear themes

You help product teams make statements like:
- "472 tickets (32% of volume) in Q4 2024"
- "Mentioned in 34 lost deals ($1.2M pipeline)"
- "ARR at Risk: $2.4M across 34 accounts"
- "Trend: +23% vs last quarter"

Always prioritize insights by:
1. Volume/frequency of mentions
2. Business impact (ARR, deal value)
3. Trend direction (increasing/decreasing)
4. Customer segment (enterprise vs mid-market)`;

export function buildQuantitativeAnalysisPrompt(
  bugs: JiraTicket[],
  requests: JiraTicket[],
  trends: TrendData | null
): string {
  const currentWeek = trends?.currentWeek;
  const bugCount = currentWeek?.bugs.length || bugs.length;
  const requestCount = currentWeek?.requests.length || requests.length;
  const totalCount = bugCount + requestCount;

  // Build a compact list of all ticket titles so Gemini can find real recurring patterns.
  // Include all tickets (capped at 2000 for token safety) with type prefix for context.
  const allTickets = [...bugs, ...requests];
  const titleSample = allTickets.slice(0, 2000);
  const titlesText = titleSample
    .map(t => `[${t.type === 'bug' ? 'B' : 'R'}] ${t.title}`)
    .join('\n');

  return `Analyze the quantitative signals from Jira ticket data.

Current Week Statistics:
- Bugs: ${bugCount} tickets
- Feature Requests: ${requestCount} tickets
- Total: ${totalCount} tickets
${trends ? `
Trend Analysis:
- Bug Trend: ${trends.bugTrend > 0 ? '+' : ''}${trends.bugTrend.toFixed(1)}% vs previous weeks
- Request Trend: ${trends.requestTrend > 0 ? '+' : ''}${trends.requestTrend.toFixed(1)}% vs previous weeks
- Total Trend: ${trends.totalTrend > 0 ? '+' : ''}${trends.totalTrend.toFixed(1)}% vs previous weeks
` : ''}
All Ticket Titles (B=bug, R=request) — use these to identify actual recurring issues:
${titlesText}

Provide a quantitative analysis in this JSON format:
{
  "summary": "Brief summary of ticket volume",
  "bugVolume": ${bugCount},
  "requestVolume": ${requestCount},
  "totalVolume": ${totalCount},
  "bugPercentage": ${totalCount > 0 ? ((bugCount / totalCount) * 100).toFixed(1) : 0},
  "requestPercentage": ${totalCount > 0 ? ((requestCount / totalCount) * 100).toFixed(1) : 0},
  "trends": {
    "bugTrend": ${trends?.bugTrend || 0},
    "requestTrend": ${trends?.requestTrend || 0},
    "totalTrend": ${trends?.totalTrend || 0}
  },
  "topIssues": ["Top 5 most frequently mentioned issues/themes from the ticket titles above"],
  "insights": ["Key quantitative insights"]
}`;
}

/**
 * Build a stratified sample that prioritises:
 *  - 40% top tickets by ARR (highest revenue impact)
 *  - 40% most recently created tickets (freshest signal)
 *  - 10% high-priority bugs not already in the above
 *  - 10% high-priority requests not already in the above
 *
 * This ensures large datasets don't get reduced to just the first N rows.
 */
function buildStratifiedSample(bugs: JiraTicket[], requests: JiraTicket[], limit: number): JiraTicket[] {
  const allTickets = [...bugs, ...requests];
  if (allTickets.length <= limit) return allTickets;

  const seen = new Set<string>();
  const result: JiraTicket[] = [];

  const addTickets = (tickets: JiraTicket[], quota: number) => {
    let added = 0;
    for (const t of tickets) {
      if (added >= quota) break;
      const key = t.key || t.id || t.title;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
        added++;
      }
    }
  };

  const byArr = [...allTickets].sort((a, b) => (b.arr || 0) - (a.arr || 0));
  const byRecency = [...allTickets].sort((a, b) => b.created.getTime() - a.created.getTime());
  const highPriBugs = bugs.filter(t => /high|critical|blocker/i.test(t.priority));
  const highPriReqs = requests.filter(t => /high|critical/i.test(t.priority));

  addTickets(byArr, Math.ceil(limit * 0.4));
  addTickets(byRecency, Math.ceil(limit * 0.4));
  addTickets(highPriBugs, Math.ceil(limit * 0.1));
  addTickets(highPriReqs, Math.ceil(limit * 0.1));

  // Fill any remaining quota from the full set
  addTickets(allTickets, limit - result.length);

  return result;
}

/**
 * Extract "+1" endorsements from comments.
 * CSMs often add comments like "+1 d1226 - Reynold School District" to signal
 * additional customer demand. Returns a count and sample of endorsements per ticket.
 */
function extractEndorsements(ticket: JiraTicket): { count: number; samples: string[] } {
  const endorsementPattern = /\+1[^a-zA-Z0-9]|also requesting|same request|this as well|us too/i;
  const endorsements = ticket.comments.filter(c => endorsementPattern.test(c));
  return {
    count: endorsements.length,
    samples: endorsements.slice(0, 3).map(c => {
      // Strip the Jira comment metadata prefix (date;authorId;text)
      const parts = c.split(';');
      return parts.length >= 3 ? parts.slice(2).join(';').substring(0, 200) : c.substring(0, 200);
    }),
  };
}

export function buildQualitativeAnalysisPrompt(
  bugs: JiraTicket[],
  requests: JiraTicket[]
): string {
  const limit = 500;
  const sample = buildStratifiedSample(bugs, requests, limit);

  const ticketData = sample.map(ticket => {
    const endorsements = extractEndorsements(ticket);
    return {
      type: ticket.type,
      title: ticket.title,
      description: ticket.description.substring(0, 500),
      priority: ticket.priority,
      customer: ticket.customer || 'Unknown',
      arr: ticket.arr,
      ...(endorsements.count > 0 ? {
        endorsementCount: endorsements.count,
        endorsementSamples: endorsements.samples,
      } : {}),
    };
  });

  // Compute total endorsements across all tickets (not just sampled)
  const allTickets = [...bugs, ...requests];
  const totalEndorsements = allTickets.reduce((sum, t) => sum + extractEndorsements(t).count, 0);

  return `Analyze customer feedback from Jira tickets to identify qualitative themes and patterns.

Analyze ${sample.length} tickets (from ${bugs.length} bugs and ${requests.length} total requests) and identify:

1. Common pain points and issues
2. Feature request themes
3. Customer sentiment patterns
4. Priority patterns (what customers care most about)
5. Demand signals from "+1" endorsements (CSMs add these to indicate additional customers want the same thing)

Note: ${totalEndorsements} "+1" endorsement comments were found across all tickets. Tickets with endorsements have endorsementCount and endorsementSamples fields — these indicate multiple customers want the same feature or are affected by the same bug. Weigh these heavily when assessing demand.

Ticket Data:
${JSON.stringify(ticketData)}

Provide analysis in this JSON format:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme represents",
      "frequency": "X% of mentions",
      "ticketTypes": ["bug" | "request"],
      "examples": ["Example ticket titles"],
      "endorsements": "Number of +1 endorsements across tickets in this theme"
    }
  ],
  "painPoints": [
    {
      "issue": "Pain point description",
      "frequency": "X% of bug reports",
      "impact": "High/Medium/Low",
      "customerSegments": ["Enterprise", "Mid-market", etc.]
    }
  ],
  "featureRequests": [
    {
      "request": "Feature request description",
      "frequency": "X% of requests",
      "value": "Business value or use case",
      "endorsements": "Number of +1 endorsements indicating multi-customer demand"
    }
  ],
  "insights": ["Key qualitative insights"]
}`;
}

export function buildQuotesPrompt(
  bugs: JiraTicket[],
  requests: JiraTicket[]
): string {
  // Prioritize tickets with ARR data and meaningful descriptions
  const allTickets = [...bugs, ...requests]
    .filter(t => t.description && t.description.length > 20)
    .sort((a, b) => (b.arr || 0) - (a.arr || 0))
    .slice(0, 100);

  const quotesData = allTickets.map(ticket => {
    // Include comment excerpts — these often contain direct customer feedback
    // and CSM "+1" endorsements with district/customer names
    const commentExcerpts = ticket.comments
      .filter(c => c.length > 10)
      .slice(0, 5)
      .map(c => {
        const parts = c.split(';');
        return parts.length >= 3 ? parts.slice(2).join(';').substring(0, 200) : c.substring(0, 200);
      });

    return {
      type: ticket.type,
      title: ticket.title,
      description: ticket.description.substring(0, 300),
      customer: ticket.customer || 'Unknown',
      account: ticket.account || 'Unknown',
      arr: ticket.arr,
      priority: ticket.priority,
      ...(commentExcerpts.length > 0 ? { comments: commentExcerpts } : {}),
    };
  });

  return `Extract representative customer quotes from Jira tickets.

Focus on:
- Compelling, specific feedback from descriptions AND comments
- High-value customers (prioritize by ARR if available)
- Diverse customer segments
- Both bugs and feature requests
- "+1" endorsements in comments that name additional affected customers/districts

Ticket Data:
${JSON.stringify(quotesData)}

Extract 5-10 representative quotes in this JSON format:
{
  "quotes": [
    {
      "quote": "Exact quote from customer (from description or comments)",
      "customer": "Customer name",
      "account": "Account/company name",
      "arr": ARR value if available,
      "type": "bug" | "request",
      "context": "Brief context about the quote",
      "additionalCustomers": ["Other customers mentioned in +1 endorsements, if any"]
    }
  ]
}`;
}

export function buildReportPrompt(
  quantitative: any,
  qualitative: any,
  quotes: any,
  reportDate: string
): string {
  return `Generate a comprehensive Customer Intelligence Report based on the analysis.

Quantitative Analysis:
${JSON.stringify(quantitative, null, 2)}

Qualitative Analysis:
${JSON.stringify(qualitative, null, 2)}

Representative Quotes:
${JSON.stringify(quotes, null, 2)}

Generate a Markdown-formatted intelligence report following this structure:

# Customer Intelligence Report
Date: ${reportDate}

## Problem Evidence

### Quantitative Signal
- Support Tickets: [Count] tickets ([Percentage]% of volume) in [Period]
- Trend: [Trend]% vs [Previous Period]
- Top Issues: [List]

### Qualitative Themes
Based on analysis of all feedback sources:

1. "[Theme 1]" ([Percentage]% of mentions)
2. "[Theme 2]" ([Percentage]% of mentions)
...

### Representative Quotes
- "[Quote]" - [Customer] ([Account Type], $[ARR] ARR)
- "[Quote]" - [Customer] ([Account Type], $[ARR] ARR)
...

## Key Insights
[Summary of most important findings]

## Recommendations
[Actionable recommendations based on the intelligence]

Generate the complete Markdown report now.`;
}

