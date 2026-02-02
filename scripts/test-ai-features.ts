
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || process.env.CORPORATE_GEMINI_KEY || process.argv[2];

if (!apiKey) {
  console.error("Please provide an API_KEY as an argument or env var.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testFeature(featureName: string, modelName: string, prompt: string) {
  console.log(`\n\n--- Testing Feature: ${featureName} [Model: ${modelName}] ---`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    console.log(`Sending prompt: "${prompt.substring(0, 50)}..."`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log(`✅ SUCCESS: [${featureName}] Response received.`);
    console.log(`preview: ${response.text().substring(0, 100)}...`);
  } catch (error) {
    console.error(`❌ FAILED: [${featureName}] - ${error.message}`);
  }
}

async function runTests() {
  // 1. Analytics (Simulate monthly forecast)
  await testFeature(
    'PREDICTIVE_ANALYTICS', 
    'gemini-2.0-flash', 
    'Analyze these financial stats: Income 5000, Expense 3000. Give me a health score.'
  );

  // 2. Categorization (Simulate transaction categorization)
  await testFeature(
    'CATEGORIZATION', 
    'gemini-2.0-flash', 
    'Categorize this transaction: "Uber Trip" - 25.00. Returns JSON.'
  );

  // 3. Recommendations (Simulate financial advice)
  await testFeature(
    'RECOMMENDATIONS', 
    'gemini-2.0-flash', 
    'I want to save for a car. Give me 3 tips.'
  );
}

runTests().catch(console.error);
