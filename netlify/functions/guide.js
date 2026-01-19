import { guideService } from '../../src/services/guide.service.js';

export async function handler(event) {
  const { packageId } = event.queryStringParameters || {};

  if (!packageId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'packageId query parameter is required.' }),
    };
  }

  try {
    const guide = await guideService.generateGuide(packageId);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guide),
    };
  } catch (error) {
    console.error(`Error generating guide for ${packageId}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to generate guide for ${packageId}.`, details: error.message }),
    };
  }
}
