import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function fetchModels() {
    if (!GEMINI_API_KEY) {
        console.error('API Key not found');
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            console.log('--- Available Models ---');
            if (data.models) {
                data.models.forEach(m => {
                    console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(', ')})`);
                });
            } else {
                console.log('No models found in the response.');
            }
        } else {
            console.error('Failed to fetch models:', JSON.stringify(data));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

fetchModels();
