# AI Agents

A simple TypeScript repository for multiple AI agents using Google Gemini. Agents can be run manually via CLI.

## Structure

```
src/
├── BaseAgent.ts                # Abstract base class for all agents
├── GeminiClient.ts             # Google Gemini API wrapper
├── google.ts                   # Google API helpers (Gmail & Calendar)
├── agents/                     # Agent implementations
│   └── calendar-assistant.ts   # Chief of Staff that provides calendar feedback and actionable next steps
│   └── email-assistant.ts      # Triages, labels and drafts replies (but doesn't send) to emails
│   └── hubspot-reviewer.ts     # HubSpot deal loss analysis agent [WIP]
└── index.ts                    # CLI entry point
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
HUBSPOT_API_KEY=your_hubspot_api_key_here
```

3. Build the project:
```bash
npm run build
```

4. Get a Google access and refresh token, add them to the `.env` file. Follow the instructions in the terminal.
```bash
npm run get-google-token
```

## Usage

### List available agents
```bash
npm start list
# or
npm run dev list
```

### Run an agent
```bash
npm start run <agent-name>
# or
npm run dev run <agent-name>
```

### Example
```bash
npm run dev run calendar-assistant
```

## Creating a New Agent

1. Create a new file in `src/agents/` (e.g., `my-agent.ts`)
2. Extend the `BaseAgent` class:
```typescript
import { BaseAgent } from '../BaseAgent.js';
import { GeminiClient } from '../GeminiClient.js';

export class MyAgent extends BaseAgent {
  name = 'my-agent';
  description = 'Description of what this agent does';

  private gemini: GeminiClient;

  constructor() {
    super();
    this.gemini = new GeminiClient();
  }

  async run(): Promise<void> {
    this.log('Starting my agent...');
    // Your agent logic here
  }
}
```

3. Register the agent in `src/index.ts`:
```typescript
import { MyAgent } from './agents/my-agent.js';

const agents: Map<string, () => BaseAgent> = new Map([
  ['hubspot-reviewer', () => new HubSpotReviewerAgent()],
  ['my-agent', () => new MyAgent()], // Add your agent here
]);
```

## Available Agents

### hubspot-reviewer
Reviews HubSpot data to identify key reasons for deal losses. Currently a placeholder - HubSpot API integration to be implemented.

## Development

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript
- `npm run dev` - Run TypeScript directly with tsx (no build step)

## Notes

- All agents run manually via CLI - no automatic scheduling
- Google OAuth integration is set up but requires OAuth flow implementation for Gmail/Calendar access
- Future agents can be added by following the pattern in `src/agents/`
