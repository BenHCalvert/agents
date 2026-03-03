# AI Agents

A simple TypeScript repository for multiple AI agents using Google Gemini. Agents can be run manually via CLI.

## Structure

```
src/
├── BaseAgent.ts                # Abstract base class for all agents
├── GeminiClient.ts             # Google Gemini API wrapper
├── google.ts                   # Google API helpers (Gmail & Calendar)
├── agents/                     # Agent implementations
│   ├── calendar-assistant.ts   # Chief of Staff that provides calendar feedback and actionable next steps
│   ├── email-assistant.ts      # AI Chief of Staff that triages, labels, and drafts replies to emails
│   ├── customer-intelligence.ts # Analyzes Jira ticket data to generate customer intelligence reports
│   ├── hubspot-reviewer.ts     # HubSpot deal loss analysis agent [WIP]
│   └── prompts/                # Prompt templates for agents
│       ├── calendar-assistant.ts
│       ├── email-assistant.ts
│       ├── customer-intelligence.ts
│       └── hubspot-reviewer.ts
├── utils/                      # Utility functions
│   └── csv-reader.ts          # CSV parsing utilities for Jira ticket data
├── scripts/                    # Utility scripts
│   ├── get-google-token.ts    # OAuth token setup script
│   └── list-gemini-models.ts  # List available Gemini models
└── index.ts                    # CLI entry point
scripts/
└── preprocess-jira-csv.py      # Preprocesses raw Jira CSV exports for customer-intelligence
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
GOOGLE_ACCESS_TOKEN=your_access_token_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here

# Optional: Email Assistant configuration
EMAIL_VIP_DOMAINS=example.com,company.com
EMAIL_VIP_SENDERS=boss@example.com,family@example.com
EMAIL_WORK_HOURS_START=9
EMAIL_WORK_HOURS_END=17

# Optional: Customer Intelligence configuration
JIRA_DATA_DIR=./data/jira
JIRA_REPORTS_DIR=./reports
JIRA_LOOKBACK_WEEKS=4
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

### Examples
```bash
# Run calendar assistant
npm run dev run calendar-assistant

# Run email assistant
npm run dev run email-assistant

# Run customer intelligence agent
npm run dev run customer-intelligence
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

### calendar-assistant
Chief of Staff that analyzes your calendar to ensure you're spending time on the most important things, identifies meetings that should be delegated, and checks that all meetings have conferencing links or locations.

### email-assistant
AI Chief of Staff that manages your inbox by:
- **Phase 1: Ruthless Triage** - Automatically archives/labels noise (marketing, system notifications)
- **Phase 2: The Drafter** - Creates draft replies for important emails (never sends automatically)
- **Phase 3: The Watchman** - Monitors latency, checks meeting links, flags spiraling threads

Requires Gmail API access with `gmail.modify`, `gmail.compose`, and `gmail.labels` scopes.

### customer-intelligence
Analyzes Jira ticket data from CSV files to generate customer intelligence reports with:
- **Quantitative Signals** - Ticket counts, trends, volume percentages
- **Qualitative Themes** - AI-analyzed patterns and pain points
- **+1 Endorsement Detection** - Identifies CSM "+1" comments that signal multi-customer demand
- **Representative Quotes** - Compelling customer feedback with context

**Data setup:**

1. Export CSV files from Jira (bugs/CROs and feature requests)
2. Preprocess and place them into `./data/jira/` (configurable via `JIRA_DATA_DIR`):

```bash
npm run preprocess-csv -- ./data/jira ~/Downloads/bugs-2026-03-02.csv ~/Downloads/requests-2026-03-02.csv
```

3. Filenames must contain `bug` or `request`/`feature` to auto-classify ticket type (e.g. `bugs-2026-03-02.csv`, `requests-2026-03-02.csv`)
4. Remove old CSV files from `./data/jira/` before each run — the agent loads **all** `.csv` files in the directory

**Run:**

```bash
npm run dev run customer-intelligence
```

Reports are saved to `./reports/` (configurable via `JIRA_REPORTS_DIR`).

**Why preprocess?** Raw Jira CSV exports contain 600+ columns, most of which are unused. The preprocessing script strips them down to ~60 useful columns and consolidates the many repeated Comment columns (Jira spreads them across 40-100 duplicate columns) into a single field. This reduces file size by 30-50% and ensures comment data — including "+1" CSM endorsements — is properly preserved.

### hubspot-reviewer
Reviews HubSpot data to identify key reasons for deal losses. Currently a placeholder - HubSpot API integration to be implemented.

## Development

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript
- `npm run dev` - Run TypeScript directly with tsx (no build step)

## Notes

- All agents run manually via CLI - no automatic scheduling
- Google OAuth integration is set up for Gmail and Calendar access
- The email-assistant requires Gmail API scopes: `gmail.modify`, `gmail.compose`, and `gmail.labels`
- Customer intelligence agent reads CSV files - download Jira ticket exports and preprocess them before running
- Future agents can be added by following the pattern in `src/agents/`
