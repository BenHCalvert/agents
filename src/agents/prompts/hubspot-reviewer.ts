/**
 * Prompts for the HubSpot Reviewer Agent
 */

export const SYSTEM_INSTRUCTION = 'You are a sales analytics expert. Analyze deal loss data and provide clear, actionable insights.';

export function buildPrompt(lostDealsData: any): string {
  return `Analyze the following HubSpot lost deals data and identify the top 3-5 key reasons why deals are being lost. 
Provide actionable insights and recommendations.

Lost Deals Data:
${JSON.stringify(lostDealsData, null, 2)}`;
}

