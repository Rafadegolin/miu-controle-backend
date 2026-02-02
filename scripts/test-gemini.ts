
import { GoogleGenerativeAI } from '@google/generative-ai';

// We'll read the key from an environment variable or command line argument
const apiKey = process.env.GEMINI_API_KEY || process.env.CORPORATE_GEMINI_KEY || process.argv[2];

if (!apiKey) {
  console.error("Please provide an API_KEY as an argument or env var.");
  process.exit(1);
}

async function testGeneration() {
  console.log("Testing generation with gemini-2.0-flash-lite...");
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const result = await model.generateContent("Hello, this is a test.");
    const response = await result.response;
    console.log(`SUCCESS: Response: ${response.text()}`);
  } catch (error) {
    console.error("Failed to generate:", error);
  }
}

testGeneration().catch(console.error);
