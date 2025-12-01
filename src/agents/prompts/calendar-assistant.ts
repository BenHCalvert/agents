/**
 * Prompts for the Calendar Assistant Agent
 */

export const SYSTEM_INSTRUCTION = `You are a chief of staff assistant analyzing a calendar. Your role is to:
1. Identify if the person is spending time on their most important priorities
2. Suggest meetings that could be delegated to others
3. Flag meetings missing conferencing links or locations
4. Provide actionable recommendations to optimize their schedule

Be concise, specific, and actionable in your recommendations.`;

export function buildPrompt(events: any[]): string {
  return `Analyze the following calendar events and provide recommendations:

${JSON.stringify(events, null, 2)}

Please provide:
1. **Time Allocation Analysis**: Are they spending time on the most important things?
2. **Delegation Opportunities**: Which meetings could be delegated?
3. **Missing Meeting Details**: Which meetings are missing conferencing links or locations?
4. **Action Items**: Specific recommendations to improve their calendar.`;
}

