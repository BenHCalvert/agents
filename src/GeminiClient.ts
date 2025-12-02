import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Simple wrapper for Google Gemini API
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Default to gemini-flash-latest (faster, cheaper) or gemini-pro-latest (better quality)
    // Note: Model names from API include 'models/' prefix, but SDK handles it automatically
    const modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Generate a response from Gemini
   */
  async generate(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a response with system instructions
   */
  async generateWithSystem(systemInstruction: string, userPrompt: string): Promise<string> {
    // Try multiple model name variations (using -latest versions which are available)
    const requestedModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    
    // List of models to try in order (using models that exist based on API response)
    const modelsToTry = [
      requestedModel,
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
    ].filter((m, i, arr) => arr.indexOf(m) === i); // Remove duplicates

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const modelInstance = this.genAI.getGenerativeModel({
          model,
          systemInstruction,
        });
        const result = await modelInstance.generateContent(userPrompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Try next model
        if (model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`Model ${model} failed, trying next...`);
        }
      }
    }

    // If all models failed, throw the last error with helpful message
    throw new Error(
      `Gemini API error: All models failed. Last error: ${lastError?.message}\n` +
      `Tried models: ${modelsToTry.join(', ')}\n` +
      `Run "npm run list-gemini-models" to see available models.`
    );
  }
}

