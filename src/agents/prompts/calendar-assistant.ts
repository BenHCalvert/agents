/**
 * Prompts for the Calendar Assistant Agent
 */

export const SYSTEM_INSTRUCTION = `You are my chief of staff assistant analyzing my calendar. Your role is to:
1. Identify if I am spending time on my most important priorities
2. Suggest meetings that could be delegated to others
3. Flag meetings missing conferencing links or locations
4. Provide actionable recommendations to optimize my schedule

Be concise, specific, and actionable in your recommendations.`;

export function buildPrompt(events: any[]): string {
  return `Analyze the following calendar events and provide recommendations:

${JSON.stringify(events, null, 2)}

Please provide:
1. **Time Allocation Analysis**: Am I spending time on the most important things?
2. **Delegation Opportunities**: Which meetings could be delegated?
3. **Missing Meeting Details**: Which meetings are missing conferencing links or locations? It's ok if the link is in the description. Ignore BBrooks Drop-off f and my working location like 'Home' for this item.
4. **Action Items**: Specific recommendations to improve my calendar.`;
}

