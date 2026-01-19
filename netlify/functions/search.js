import { searchService } from '../../src/services/search.service.js';

export async function handler(event) {
  const { q } = event.queryStringParameters || {};

  try {
    const results = await searchService.findPackages(q);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to search packages.' }),
    };
  }
}
