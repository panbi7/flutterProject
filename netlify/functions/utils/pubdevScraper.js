import * as cheerio from 'cheerio';

/**
 * Scrapes the example code from pub.dev for a given package.
 * @param {string} packageName 
 * @returns {Promise<string|null>} The example code or null if not found.
 */
export async function getExampleCode(packageName) {
    try {
        const url = `https://pub.dev/packages/${packageName}/example`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`[PubDev Scraper] Failed to fetch example page for ${packageName}: ${response.status}`);
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Try to find the code block in the example content
        // Pub.dev structure usually puts the file content in a code block
        // We look for the main code block area.
        let code = $('pre.language-dart code').first().text();

        // Fallback: sometimes it might not have the language class if not detected
        if (!code) {
            code = $('pre code').first().text();
        }

        // specific handling for cases where multiple files might be shown, we usually want the first main one
        // or if the structure is different (e.g. inside a section)

        if (!code || code.trim().length === 0) {
            console.warn(`[PubDev Scraper] No code block found on example page for ${packageName}`);
            return null;
        }

        return code;

    } catch (error) {
        console.error(`[PubDev Scraper] Error scraping ${packageName}:`, error.message);
        return null;
    }
}
