import { BaseAgent } from '../BaseAgent.js';
import { GeminiClient } from '../GeminiClient.js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  readCSVFiles,
  groupTicketsByWeek,
  calculateTrends,
  type JiraTicket,
} from '../utils/csv-reader.js';
import {
  SYSTEM_INSTRUCTION,
  buildQuantitativeAnalysisPrompt,
  buildQualitativeAnalysisPrompt,
  buildQuotesPrompt,
  buildReportPrompt,
} from './prompts/customer-intelligence.js';

/**
 * Customer Intelligence Agent
 * 
 * Analyzes customer feedback from Jira tickets (bugs and feature requests)
 * to generate intelligence reports with quantitative signals, qualitative themes,
 * and representative quotes to inform product decisions.
 */
export class CustomerIntelligenceAgent extends BaseAgent {
  name = 'customer-intelligence';
  description = 'Analyzes Jira ticket data to generate customer intelligence reports with quantitative signals, qualitative themes, and representative quotes';

  private gemini: GeminiClient;
  private dataDir: string;
  private reportsDir: string;
  private lookbackWeeks: number;

  constructor() {
    super();
    this.gemini = new GeminiClient();
    
    // Load configuration from environment variables
    this.dataDir = process.env.JIRA_DATA_DIR || './data/jira';
    this.reportsDir = process.env.JIRA_REPORTS_DIR || './reports';
    this.lookbackWeeks = parseInt(process.env.JIRA_LOOKBACK_WEEKS || '4', 10);
  }

  async run(): Promise<void> {
    this.log('Starting customer intelligence analysis...');

    try {
      // Phase 1: Data Collection
      this.log('\n=== Phase 1: Data Collection ===');
      const { bugs, requests } = await this.collectData();
      
      if (bugs.length === 0 && requests.length === 0) {
        this.log('No ticket data found. Please ensure CSV files are in the data directory.');
        return;
      }

      this.log(`Loaded ${bugs.length} bug tickets and ${requests.length} feature request tickets`);

      // Phase 2: Quantitative Analysis
      this.log('\n=== Phase 2: Quantitative Analysis ===');
      const quantitative = await this.performQuantitativeAnalysis(bugs, requests);

      // Phase 3: Qualitative Analysis
      this.log('\n=== Phase 3: Qualitative Analysis ===');
      const qualitative = await this.performQualitativeAnalysis(bugs, requests);

      // Phase 4: Representative Quotes
      this.log('\n=== Phase 4: Extracting Representative Quotes ===');
      const quotes = await this.extractQuotes(bugs, requests);

      // Phase 5: Report Generation
      this.log('\n=== Phase 5: Generating Intelligence Report ===');
      const reportPath = await this.generateReport(quantitative, qualitative, quotes);

      this.log(`\n✅ Customer Intelligence Report generated: ${reportPath}`);
      this.log('\n=== Analysis Complete ===\n');

    } catch (error) {
      this.error('Failed to generate customer intelligence report', error);
      throw error;
    }
  }

  private async collectData(): Promise<{ bugs: JiraTicket[]; requests: JiraTicket[] }> {
    this.log(`Reading CSV files from: ${this.dataDir}`);
    
    try {
      const { bugs, requests } = await readCSVFiles(this.dataDir);
      return { bugs, requests };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        this.error(`Data directory not found: ${this.dataDir}`);
        this.log('Please create the directory and add CSV files with the following naming:');
        this.log('  - bugs-YYYY-MM-DD.csv');
        this.log('  - requests-YYYY-MM-DD.csv');
      }
      throw error;
    }
  }

  private async performQuantitativeAnalysis(
    bugs: JiraTicket[],
    requests: JiraTicket[]
  ): Promise<any> {
    this.log('Analyzing ticket volumes and trends...');

    // Group tickets by week
    const groups = groupTicketsByWeek(bugs, requests);
    const trends = calculateTrends(groups, this.lookbackWeeks);

    if (trends) {
      this.log(`Current week: ${trends.currentWeek.bugs.length} bugs, ${trends.currentWeek.requests.length} requests`);
      this.log(`Bug trend: ${trends.bugTrend > 0 ? '+' : ''}${trends.bugTrend.toFixed(1)}%`);
      this.log(`Request trend: ${trends.requestTrend > 0 ? '+' : ''}${trends.requestTrend.toFixed(1)}%`);
    }

    const prompt = buildQuantitativeAnalysisPrompt(bugs, requests, trends);
    const response = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.error('Failed to parse quantitative analysis from Gemini response');
      return {
        summary: 'Analysis incomplete',
        bugVolume: bugs.length,
        requestVolume: requests.length,
        totalVolume: bugs.length + requests.length,
      };
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.error('Failed to parse quantitative analysis JSON', error);
      return {
        summary: 'Analysis incomplete',
        bugVolume: bugs.length,
        requestVolume: requests.length,
        totalVolume: bugs.length + requests.length,
      };
    }
  }

  private async performQualitativeAnalysis(
    bugs: JiraTicket[],
    requests: JiraTicket[]
  ): Promise<any> {
    this.log('Identifying themes and patterns in customer feedback...');

    const prompt = buildQualitativeAnalysisPrompt(bugs, requests);
    const response = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.error('Failed to parse qualitative analysis from Gemini response');
      return {
        themes: [],
        painPoints: [],
        featureRequests: [],
        insights: [],
      };
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.error('Failed to parse qualitative analysis JSON', error);
      return {
        themes: [],
        painPoints: [],
        featureRequests: [],
        insights: [],
      };
    }
  }

  private async extractQuotes(
    bugs: JiraTicket[],
    requests: JiraTicket[]
  ): Promise<any> {
    this.log('Extracting representative customer quotes...');

    const prompt = buildQuotesPrompt(bugs, requests);
    const response = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.error('Failed to parse quotes from Gemini response');
      return { quotes: [] };
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.error('Failed to parse quotes JSON', error);
      return { quotes: [] };
    }
  }

  private async generateReport(
    quantitative: any,
    qualitative: any,
    quotes: any
  ): Promise<string> {
    this.log('Generating final intelligence report...');

    const prompt = buildReportPrompt(quantitative, qualitative, quotes);
    const report = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);

    // Ensure reports directory exists
    try {
      await mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }

    // Generate filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `customer-intelligence-${dateStr}.md`;
    const filePath = join(this.reportsDir, filename);

    // Write report to file
    await writeFile(filePath, report, 'utf-8');

    // Also output to console
    this.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.log('                    INTELLIGENCE REPORT');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(report);
    this.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return filePath;
  }
}

