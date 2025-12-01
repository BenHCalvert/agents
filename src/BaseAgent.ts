/**
 * Base class for all AI agents
 */
export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;

  /**
   * Main execution method that each agent must implement
   */
  abstract run(): Promise<void>;

  /**
   * Log a message with agent context
   */
  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  /**
   * Log an error with agent context
   */
  protected error(message: string, error?: unknown): void {
    console.error(`[${this.name}] ERROR: ${message}`, error);
  }
}

