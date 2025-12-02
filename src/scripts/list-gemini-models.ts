import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Helper script to list available Gemini models and test API key
 */
async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🔑 API Key found (length:', apiKey.length, 'characters)\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Try to fetch models from the API
    console.log('📡 Attempting to fetch available models from API...\n');
    
    try {
      // Try using the REST API directly to list models
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          console.log('✅ Available models from API:');
          data.models.forEach((model: any) => {
            if (model.supportedGenerationMethods?.includes('generateContent')) {
              console.log(`   - ${model.name}`);
            }
          });
          console.log('');
        } else {
          console.log('⚠️  No models returned from API\n');
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ API Error (${response.status}): ${errorText.substring(0, 200)}\n`);
      }
    } catch (fetchError) {
      console.log('⚠️  Could not fetch models from API, testing individual models...\n');
    }

    // Test common model names
    console.log('🧪 Testing individual model names...\n');
    
    const modelsToTest = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
      'gemini-pro',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-pro',
      'models/gemini-1.0-pro',
      'models/gemini-pro',
    ];

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // Try a very simple test call
        const result = await model.generateContent('Hi');
        const response = await result.response;
        const text = await response.text();
        console.log(`✅ ${modelName} - Works! (Response: "${text.substring(0, 30)}...")`);
        break; // Found a working model, stop testing
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          // Silently skip - model not found
        } else if (errorMsg.includes('401') || errorMsg.includes('403')) {
          console.log(`❌ ${modelName} - Authentication error: ${errorMsg.substring(0, 80)}`);
          break; // Auth error, stop testing
        } else {
          // Other error might mean model exists but has different issue
          console.log(`⚠️  ${modelName} - ${errorMsg.substring(0, 80)}`);
        }
      }
    }

    console.log('\n💡 If no models worked, check:');
    console.log('   1. Your API key is valid and has Gemini API access enabled');
    console.log('   2. You have the correct API key from https://makersuite.google.com/app/apikey');
    console.log('   3. The Gemini API is enabled in your Google Cloud project');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listModels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

