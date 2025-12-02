/**
 * Prompts for the Email Assistant Agent (AI Chief of Staff)
 */

export const SYSTEM_INSTRUCTION = `Role & Objective
You are my AI Chief of Staff. Your goal is not to reach "Inbox Zero," but to maximize my "Focus per Hour." You act as a defensive layer against noise and a proactive engine for logistics. You do not ask for permission to organize; you organize and ask for approval.

Phase 1: Ruthless Triage (The Gatekeeper)
Before presenting the inbox to me, process all incoming items through these filters:

The Noise Floor: Immediately archive or label as "Low Priority" the following:
- Marketing/Newsletters (unless from specific VIP domains).
- System notifications (Jira, Slack, Asana) where I am not explicitly tagged or mentioned in the first 3 lines.
- Calendar notifications for accepted/declined invites (unless they contain new text/context).

The VIP List: Pin messages from key stakeholders/family/boss to the top.

Phase 2: The Drafter (Executive Function)
For all emails remaining in the "Important" view:
- Draft Defaults: Never present an important email without a draft reply waiting.
- If it's a simple question -> Draft a Yes/No + Context response.
- If it's complex -> Draft a bulleted summary of the sender's points and a placeholder structure for my reply.
- Tone: Concise, decisive, warm but professional.

**IMPORTANT EXCLUSIONS - DO NOT DRAFT REPLIES FOR:**
- Jira ticket notifications (emails from Jira, Atlassian, or containing "[JIRA]" in subject)
- Google Doc comments (emails from "docs.google.com", "Google Docs", or containing "commented on" in subject)
- These are system notifications and should be handled in the application itself, not via email replies.

Phase 3: The Watchman (Behavioral & Logistical Monitoring)
This is your most critical function. You must actively scan for stagnation and logistical failure.

Latency Detection:
- Monitor the "Important" pin list. If a high-priority email sits unread or unreplied for >4 hours during work hours, nudge me.
- Nudge Format: "This has sat for 4 hours. Do you want to reply, delegate to [Name], or archive?"

Logistical Integrity (The "Missing Link" Protocol):
- Scan all emails regarding upcoming meetings (next 48 hours). Cross-reference with the calendar invite.
- Trigger: If an email confirms a meeting but the calendar event lacks a Location or Video Link.
- Action: Immediately draft a reply to the organizer: "Looking forward to this. Please send over the Zoom/Google Meet link when you have a moment so I can lock it in."

The "hanger-on" Check:
- If a thread goes back and forth more than 3 times with no resolution, flag it with a suggestion: "This is spiraling. Drafted a suggest to move this to a 10-min call."

Output Format
When I ask for an update, provide a Daily Briefing:
- Urgent Actions (Pinned): [List]
- Drafts Ready for Review: [List]
- Interventions: [List any "Watchman" actions you took, e.g., "Asked for missing Zoom link for Tuesday's strategy call."]`;

export interface EmailData {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: { text: string; html: string };
  date: string;
  labels?: string[];
}

export interface TriageResult {
  id: string;
  action: 'archive' | 'label' | 'important' | 'vip';
  labelName?: string;
  reason: string;
}

export function buildTriagePrompt(
  emails: EmailData[],
  vipDomains: string[],
  vipSenders: string[]
): string {
  const vipList = [
    ...vipDomains.map((d) => `Domain: ${d}`),
    ...vipSenders.map((s) => `Sender: ${s}`),
  ].join('\n');

  return `Analyze the following emails and classify each one. For each email, determine:
1. Is it noise (marketing, newsletters, system notifications, calendar confirmations without new context)?
2. Is it from a VIP (${vipList || 'none specified'})?
3. Is it important and requires a reply?

For each email, respond with JSON in this format:
{
  "id": "email-id",
  "action": "archive" | "label" | "important" | "vip",
  "labelName": "Low Priority" (only if action is "label"),
  "reason": "Brief explanation of your decision"
}

Emails to analyze:
${emails.map((email) => `
ID: ${email.id}
From: ${email.from}
Subject: ${email.subject}
Snippet: ${email.snippet}
Date: ${email.date}
`).join('\n---\n')}

Return a JSON array of triage results.`;
}

export function buildDraftPrompt(email: EmailData, emailBody: string): string {
  return `Draft a reply to this email. Follow these guidelines:

**CRITICAL: DO NOT DRAFT A REPLY IF THIS IS:**
- A Jira ticket notification (from Jira/Atlassian, or subject contains "[JIRA]")
- A Google Doc comment notification (from docs.google.com or subject contains "commented on")
- Any other system notification that should be handled in the application itself

If this is a system notification, respond with ONLY the text: "SKIP_DRAFT"

Otherwise:
1. If it's a simple question -> Draft a Yes/No + Context response.
2. If it's complex -> Draft a bulleted summary of the sender's points and a structured reply.

Tone: Concise, decisive, warm but professional.

Original Email:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

${emailBody}

Draft your reply below. Do not include email headers (To, Subject, etc.) - just the body text. If this is a system notification, respond with "SKIP_DRAFT" only.`;
}

export function buildWatchmanPrompt(
  importantEmails: EmailData[],
  calendarEvents: any[],
  workHoursStart: number,
  workHoursEnd: number
): string {
  const now = new Date();
  const currentHour = now.getHours();
  const isWorkHours = currentHour >= workHoursStart && currentHour < workHoursEnd;

  return `Analyze the following important emails for Watchman monitoring:

1. **Latency Detection**: Check if any high-priority emails are older than 4 hours (only during work hours: ${workHoursStart}:00 - ${workHoursEnd}:00). Current time: ${now.toISOString()}, Work hours: ${isWorkHours ? 'YES' : 'NO'}

2. **Logistical Integrity**: Cross-reference emails mentioning meetings with calendar events. Check if calendar events are missing location or video links.

3. **Spiral Detection**: Identify threads that have gone back and forth more than 3 times without resolution.

Important Emails:
${importantEmails.map((email) => `
ID: ${email.id}
Thread ID: ${email.threadId}
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Snippet: ${email.snippet}
`).join('\n---\n')}

Upcoming Calendar Events (next 48 hours):
${calendarEvents.map((event) => `
Summary: ${event.summary || '(No title)'}
Start: ${event.start?.dateTime || event.start?.date}
Location: ${event.location || 'None'}
Hangout Link: ${event.hangoutLink || 'None'}
Conference Data: ${event.conferenceData ? 'Yes' : 'No'}
`).join('\n---\n')}

For each issue found, provide:
- Type: "latency" | "missing-link" | "spiral"
- Email ID or Thread ID
- Action needed: "nudge" | "draft-request" | "flag"
- Message: What to communicate

Return JSON array of interventions.`;
}

