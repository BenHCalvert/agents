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
  "topIssues": ["List of top 3-5 issues by frequency"],
  "insights": ["Key quantitative insights"]
}`;
}

export function buildQualitativeAnalysisPrompt(
  bugs: JiraTicket[],
  requests: JiraTicket[]
): string {
  const allTickets = [...bugs, ...requests];
  const sampleSize = Math.min(50, allTickets.length);
  const sample = allTickets.slice(0, sampleSize);

  const ticketData = sample.map(ticket => ({
    type: ticket.type,
    title: ticket.title,
    description: ticket.description.substring(0, 500), // Limit description length
    priority: ticket.priority,
    customer: ticket.customer || 'Unknown',
    arr: ticket.arr,
  }));

  return `Analyze customer feedback from Jira tickets to identify qualitative themes and patterns.

Analyze ${sample.length} tickets (${bugs.length} bugs, ${requests.length} requests) and identify:

1. Common pain points and issues
2. Feature request themes
3. Customer sentiment patterns
4. Priority patterns (what customers care most about)

Ticket Data:
${JSON.stringify(ticketData, null, 2)}

Provide analysis in this JSON format:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme represents",
      "frequency": "X% of mentions",
      "ticketTypes": ["bug" | "request"],
      "examples": ["Example ticket titles"]
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
      "value": "Business value or use case"
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
    .slice(0, 30); // Top 30 by ARR or first 30

  const quotesData = allTickets.map(ticket => ({
    type: ticket.type,
    title: ticket.title,
    description: ticket.description.substring(0, 300),
    customer: ticket.customer || 'Unknown',
    account: ticket.account || 'Unknown',
    arr: ticket.arr,
    priority: ticket.priority,
  }));

  return `Extract representative customer quotes from Jira tickets.

Focus on:
- Compelling, specific feedback
- High-value customers (prioritize by ARR if available)
- Diverse customer segments
- Both bugs and feature requests

Ticket Data:
${JSON.stringify(quotesData, null, 2)}

Extract 5-10 representative quotes in this JSON format:
{
  "quotes": [
    {
      "quote": "Exact quote from customer",
      "customer": "Customer name",
      "account": "Account/company name",
      "arr": ARR value if available,
      "type": "bug" | "request",
      "context": "Brief context about the quote"
    }
  ]
}`;
}

export function buildReportPrompt(
  quantitative: any,
  qualitative: any,
  quotes: any
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
Date: [Current Date]

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

