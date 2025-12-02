import { BaseAgent } from '../BaseAgent.js';
import { GeminiClient } from '../GeminiClient.js';
import {
  getGmailClient,
  getEmailContent,
  parseEmailBody,
  getEmailHeaders,
  archiveEmail,
  labelEmail,
  getOrCreateLabel,
  createDraft,
  getEmailThread,
  searchEmails,
  getCalendarEvents,
} from '../google.js';
import {
  SYSTEM_INSTRUCTION,
  buildTriagePrompt,
  buildDraftPrompt,
  buildWatchmanPrompt,
  type EmailData,
  type TriageResult,
} from './prompts/email-assistant.js';

/**
 * Email Assistant Agent (AI Chief of Staff)
 * 
 * Acts as a defensive layer against noise and a proactive engine for logistics.
 * Implements three-phase inbox management:
 * 1. Ruthless Triage - Archive/label noise automatically
 * 2. The Drafter - Create draft replies for important emails
 * 3. The Watchman - Monitor latency, check meeting links, flag spiraling threads
 */
export class EmailAssistantAgent extends BaseAgent {
  name = 'email-assistant';
  description = 'AI Chief of Staff that manages your inbox by triaging emails, drafting replies, and monitoring inbox health';

  private gemini: GeminiClient;
  private vipDomains: string[];
  private vipSenders: string[];
  private workHoursStart: number;
  private workHoursEnd: number;

  constructor() {
    super();
    this.gemini = new GeminiClient();
    
    // Load configuration from environment variables
    this.vipDomains = process.env.EMAIL_VIP_DOMAINS?.split(',').map(d => d.trim()).filter(Boolean) || [];
    this.vipSenders = process.env.EMAIL_VIP_SENDERS?.split(',').map(s => s.trim()).filter(Boolean) || [];
    this.workHoursStart = parseInt(process.env.EMAIL_WORK_HOURS_START || '9', 10);
    this.workHoursEnd = parseInt(process.env.EMAIL_WORK_HOURS_END || '17', 10);
  }

  async run(): Promise<void> {
    this.log('Starting email assistant (AI Chief of Staff)...');

    try {
      // Fetch recent emails (last 48 hours)
      this.log('Fetching recent emails...');
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoTimestamp = Math.floor(twoDaysAgo.getTime() / 1000);
      
      const emailMessages = await searchEmails(`after:${twoDaysAgoTimestamp}`, 100);
      
      if (emailMessages.length === 0) {
        this.log('No recent emails found.');
        return;
      }

      this.log(`Found ${emailMessages.length} recent emails`);

      // Fetch full email content
      const emails: EmailData[] = [];
      for (const msg of emailMessages.slice(0, 50)) { // Limit to 50 for performance
        try {
          const fullMessage = await getEmailContent(msg.id!);
          const headers = getEmailHeaders(fullMessage);
          const body = parseEmailBody(fullMessage);
          
          emails.push({
            id: msg.id!,
            threadId: fullMessage.threadId || '',
            from: headers.from || '',
            to: headers.to || '',
            subject: headers.subject || '(No subject)',
            snippet: fullMessage.snippet || '',
            body,
            date: headers.date || '',
            labels: fullMessage.labelIds || [],
          });
        } catch (error) {
          this.error(`Failed to fetch email ${msg.id}`, error);
        }
      }

      if (emails.length === 0) {
        this.log('No emails could be processed.');
        return;
      }

      // Phase 1: Ruthless Triage
      this.log('\n=== Phase 1: Ruthless Triage ===');
      const triageResults = await this.performTriage(emails);
      
      // Phase 2: The Drafter
      this.log('\n=== Phase 2: The Drafter ===');
      const importantEmails = emails.filter(
        (e) => !triageResults.find((r) => r.id === e.id && (r.action === 'archive' || r.action === 'label'))
      );
      const draftResults = await this.createDrafts(importantEmails);

      // Phase 3: The Watchman
      this.log('\n=== Phase 3: The Watchman ===');
      const vipEmails = emails.filter(
        (e) => triageResults.find((r) => r.id === e.id && r.action === 'vip')
      );
      const watchmanResults = await this.performWatchman([...importantEmails, ...vipEmails]);

      // Daily Briefing
      this.log('\n=== Daily Briefing ===');
      this.printDailyBriefing(vipEmails, draftResults, watchmanResults);

    } catch (error) {
      if (error instanceof Error && error.message.includes('GOOGLE_CLIENT_ID')) {
        this.error('Google OAuth credentials not configured. Please set up GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
        this.log('See README for instructions on setting up Google OAuth.');
      } else {
        this.error('Failed to process emails', error);
      }
      throw error;
    }
  }

  private async performTriage(emails: EmailData[]): Promise<TriageResult[]> {
    this.log('Classifying emails for triage...');
    
    const prompt = buildTriagePrompt(emails, this.vipDomains, this.vipSenders);
    
    try {
      const response = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);
      
      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.error('Failed to parse triage results from Gemini response');
        return [];
      }

      const results: TriageResult[] = JSON.parse(jsonMatch[0]);
      
      // Execute triage actions
      this.log(`Processing ${results.length} triage decisions...`);
      
      for (const result of results) {
        const email = emails.find((e) => e.id === result.id);
        if (!email) continue;

        try {
          if (result.action === 'archive') {
            await archiveEmail(result.id);
            this.log(`  ✓ Archived: ${email.subject.substring(0, 50)}`);
          } else if (result.action === 'label') {
            const labelName = result.labelName || 'Low Priority';
            const labelId = await getOrCreateLabel(labelName);
            await labelEmail(result.id, labelId);
            this.log(`  ✓ Labeled "${labelName}": ${email.subject.substring(0, 50)}`);
          } else if (result.action === 'vip') {
            // Pin VIP emails by applying a VIP label
            const labelId = await getOrCreateLabel('VIP');
            await labelEmail(result.id, labelId);
            this.log(`  ✓ Marked as VIP: ${email.subject.substring(0, 50)}`);
          } else if (result.action === 'important') {
            this.log(`  → Important: ${email.subject.substring(0, 50)}`);
          }
        } catch (error) {
          this.error(`Failed to process triage action for ${result.id}`, error);
        }
      }

      return results;
    } catch (error) {
      this.error('Failed to perform triage', error);
      return [];
    }
  }

  private async createDrafts(emails: EmailData[]): Promise<Array<{ emailId: string; draftId: string; subject: string }>> {
    this.log(`Creating drafts for ${emails.length} important emails...`);
    
    const draftResults: Array<{ emailId: string; draftId: string; subject: string }> = [];

    for (const email of emails.slice(0, 20)) { // Limit to 20 for performance
      try {
        // Skip if already replied or has a draft
        if (email.labels?.includes('SENT') || email.labels?.includes('DRAFT')) {
          continue;
        }

        // Skip Jira tickets and Google Doc comments
        const isJira = email.from.toLowerCase().includes('jira') || 
                      email.from.toLowerCase().includes('atlassian') ||
                      email.subject.toLowerCase().includes('[jira]');
        const isGoogleDoc = email.from.toLowerCase().includes('docs.google.com') ||
                           email.from.toLowerCase().includes('google docs') ||
                           email.subject.toLowerCase().includes('commented on');
        
        if (isJira || isGoogleDoc) {
          this.log(`  ⊘ Skipped (system notification): ${email.subject.substring(0, 50)}`);
          continue;
        }

        const emailBody = email.body.text || email.body.html || email.snippet;
        const prompt = buildDraftPrompt(email, emailBody);
        
        const draftBody = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);
        
        // Check if Gemini decided to skip this draft
        if (draftBody.trim().toUpperCase() === 'SKIP_DRAFT') {
          this.log(`  ⊘ Skipped (AI determined system notification): ${email.subject.substring(0, 50)}`);
          continue;
        }
        
        // Extract just the body (remove any headers if Gemini included them)
        const cleanDraftBody = draftBody
          .replace(/^To:.*$/gm, '')
          .replace(/^Subject:.*$/gm, '')
          .replace(/^From:.*$/gm, '')
          .trim();

        const headers = getEmailHeaders(await getEmailContent(email.id));
        const replyTo = headers.from || email.from;
        const replySubject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;

        const draft = await createDraft(
          replyTo,
          replySubject,
          cleanDraftBody,
          email.threadId,
          email.id
        );

        draftResults.push({
          emailId: email.id,
          draftId: draft.id || '',
          subject: email.subject,
        });

        this.log(`  ✓ Draft created: ${email.subject.substring(0, 50)}`);
      } catch (error) {
        this.error(`Failed to create draft for ${email.id}`, error);
      }
    }

    return draftResults;
  }

  private async performWatchman(
    importantEmails: EmailData[]
  ): Promise<Array<{ type: string; action: string; message: string; emailId?: string }>> {
    this.log('Performing Watchman monitoring...');
    
    // Fetch upcoming calendar events (next 48 hours)
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const calendarEvents = await getCalendarEvents(twoDaysFromNow.toISOString());

    const prompt = buildWatchmanPrompt(
      importantEmails,
      calendarEvents,
      this.workHoursStart,
      this.workHoursEnd
    );

    try {
      const response = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);
      
      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.error('Failed to parse watchman results from Gemini response');
        return [];
      }

      const interventions: Array<{ type: string; action: string; message: string; emailId?: string; threadId?: string }> = 
        JSON.parse(jsonMatch[0]);

      // Execute watchman actions
      for (const intervention of interventions) {
        try {
          if (intervention.action === 'nudge') {
            this.log(`  ⚠️  Latency detected: ${intervention.message}`);
          } else if (intervention.action === 'draft-request') {
            // Find the email and create a draft requesting the meeting link
            const email = importantEmails.find((e) => 
              e.id === intervention.emailId || e.threadId === intervention.threadId
            );
            
            if (email) {
              const headers = getEmailHeaders(await getEmailContent(email.id));
              const requestMessage = "Looking forward to this. Please send over the Zoom/Google Meet link when you have a moment so I can lock it in.";
              
              await createDraft(
                headers.from || email.from,
                `Re: ${email.subject}`,
                requestMessage,
                email.threadId,
                email.id
              );
              
              this.log(`  ✓ Drafted link request: ${email.subject.substring(0, 50)}`);
            }
          } else if (intervention.action === 'flag') {
            this.log(`  🚩 Spiral detected: ${intervention.message}`);
          }
        } catch (error) {
          this.error(`Failed to process watchman intervention`, error);
        }
      }

      return interventions;
    } catch (error) {
      this.error('Failed to perform watchman monitoring', error);
      return [];
    }
  }

  private printDailyBriefing(
    vipEmails: EmailData[],
    draftResults: Array<{ emailId: string; draftId: string; subject: string }>,
    watchmanResults: Array<{ type: string; action: string; message: string; emailId?: string }>
  ): void {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    DAILY BRIEFING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Urgent Actions (Pinned)
    console.log('📌 Urgent Actions (Pinned):');
    if (vipEmails.length === 0) {
      console.log('   None');
    } else {
      vipEmails.slice(0, 10).forEach((email) => {
        console.log(`   • ${email.subject.substring(0, 60)}`);
        console.log(`     From: ${email.from.substring(0, 50)}`);
      });
    }

    // Drafts Ready for Review
    console.log('\n✍️  Drafts Ready for Review:');
    if (draftResults.length === 0) {
      console.log('   None');
    } else {
      draftResults.forEach((draft) => {
        console.log(`   • ${draft.subject.substring(0, 60)}`);
      });
    }

    // Interventions
    console.log('\n🔍 Interventions:');
    if (watchmanResults.length === 0) {
      console.log('   None');
    } else {
      watchmanResults.forEach((intervention) => {
        const icon = intervention.type === 'latency' ? '⏰' : 
                    intervention.type === 'missing-link' ? '🔗' : 
                    intervention.type === 'spiral' ? '🌀' : '⚠️';
        console.log(`   ${icon} ${intervention.message}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

