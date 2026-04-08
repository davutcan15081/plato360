import { Gemma4Service } from '../services/gemma4Service';

/**
 * Test Gemma4 integration
 * This function can be used to verify that Gemma4 service is working correctly
 */
export async function testGemma4Integration(): Promise<void> {
  console.log('Testing Gemma4 integration...');
  
  try {
    // Create service instance
    const gemma4Service = new Gemma4Service({
      model: 'gemma4:e4b',
      baseUrl: 'http://localhost:11434'
    });

    // Test connection
    console.log('Testing connection to Ollama...');
    const isConnected = await gemma4Service.testConnection();
    console.log('Connection status:', isConnected);
    
    if (!isConnected) {
      console.error('Cannot connect to Ollama service. Make sure Ollama is running on localhost:11434');
      return;
    }

    // Check model availability
    console.log('Checking Gemma4 model availability...');
    const isModelAvailable = await gemma4Service.isModelAvailable();
    console.log('Model available:', isModelAvailable);
    
    if (!isModelAvailable) {
      console.log('Gemma4 model not found. Attempting to pull...');
      await gemma4Service.pullModel();
      console.log('Model pulled successfully');
    }

    // Test text generation
    console.log('Testing text generation...');
    const textResponse = await gemma4Service.generateText('Hello, can you introduce yourself?');
    console.log('Text response:', textResponse);

    // Test JSON generation
    console.log('Testing JSON generation...');
    const jsonResponse = await gemma4Service.generateJson<{message: string}>('Generate a JSON object with a "message" field saying "Hello from Gemma4"');
    console.log('JSON response:', jsonResponse);

    console.log('Gemma4 integration test completed successfully!');
    
  } catch (error) {
    console.error('Gemma4 integration test failed:', error);
  }
}

/**
 * Quick connection test for the UI
 */
export async function quickGemma4Test(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const service = new Gemma4Service({
      model: 'gemma4:e4b',
      baseUrl
    });
    return await service.testConnection();
  } catch (error) {
    return false;
  }
}
