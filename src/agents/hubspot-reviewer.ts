import { BaseAgent } from '../BaseAgent.js';
import { GeminiClient } from '../GeminiClient.js';
import { SYSTEM_INSTRUCTION, buildPrompt } from './prompts/hubspot-reviewer.js';

/**
 * HubSpot Deal Loss Analysis Agent
 * 
 * This agent reviews HubSpot data on a weekly basis and identifies
 * key reasons why deals are being lost.
 */
export class HubSpotReviewerAgent extends BaseAgent {
  name = 'hubspot-reviewer';
  description = 'Reviews HubSpot data to identify key reasons for deal losses';

  private gemini: GeminiClient;

  constructor() {
    super();
    this.gemini = new GeminiClient();
  }

  async run(): Promise<void> {
    this.log('Starting HubSpot deal loss analysis...');

    try {
      // TODO: Connect to HubSpot API and fetch lost deals data
      // For now, this is a placeholder implementation
      this.log('Fetching lost deals from HubSpot...');
      
      // Placeholder: In the future, this would fetch actual HubSpot data
      const lostDealsData = {
        totalLost: 0,
        deals: [],
        // Example structure:
        // deals: [
        //   { id: '1', name: 'Deal 1', reason: 'Price too high', stage: 'Closed Lost' },
        //   ...
        // ]
      };

      if (lostDealsData.totalLost === 0) {
        this.log('No lost deals found in the specified period.');
        return;
      }

      // Use Gemini to analyze the data
      const prompt = buildPrompt(lostDealsData);

      this.log('Analyzing data with Gemini...');
      const analysis = await this.gemini.generateWithSystem(SYSTEM_INSTRUCTION, prompt);

      this.log('\n=== HubSpot Deal Loss Analysis ===');
      console.log(analysis);
      this.log('=== End of Analysis ===\n');

    } catch (error) {
      this.error('Failed to analyze HubSpot data', error);
      throw error;
    }
  }
}

