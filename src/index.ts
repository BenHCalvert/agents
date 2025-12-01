#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { HubSpotReviewerAgent } from './agents/hubspot-reviewer.js';
import { BaseAgent } from './BaseAgent.js';

dotenv.config();

const program = new Command();

// Registry of available agents
const agents: Map<string, () => BaseAgent> = new Map([
  ['hubspot-reviewer', () => new HubSpotReviewerAgent()],
  // Add more agents here as you create them
]);

program
  .name('agents')
  .description('AI agents using Google Gemini')
  .version('1.0.0');

program
  .command('list')
  .description('List all available agents')
  .action(() => {
    console.log('\nAvailable agents:');
    agents.forEach((factory, name) => {
      const agent = factory();
      console.log(`  - ${name}: ${agent.description}`);
    });
    console.log();
  });

program
  .command('run <agent-name>')
  .description('Run a specific agent')
  .action(async (agentName: string) => {
    const factory = agents.get(agentName);
    if (!factory) {
      console.error(`Error: Agent "${agentName}" not found.`);
      console.log('Use "agents list" to see available agents.');
      process.exit(1);
    }

    try {
      const agent = factory();
      console.log(`\nRunning agent: ${agent.name}`);
      console.log(`Description: ${agent.description}\n`);
      await agent.run();
      console.log(`\nAgent "${agent.name}" completed successfully.\n`);
    } catch (error) {
      console.error(`\nAgent "${agentName}" failed:`, error);
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();

