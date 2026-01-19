import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), 'data/cache');

async function get(key) {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    console.log(`[Cache] HIT: ${key}`);
    return JSON.parse(data);
  } catch (error) {
    console.log(`[Cache] MISS: ${key}`);
    return null;
  }
}

async function set(key, value) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
    console.log(`[Cache] SET: ${key}`);
  } catch (error) {
    console.error(`[Cache] FAILED TO SET ${key}:`, error);
  }
}

export const cacheService = { get, set };
