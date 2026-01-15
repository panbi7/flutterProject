import { getExampleCode } from './netlify/functions/utils/pubdevScraper.js';

async function test() {
    const pkg = 'animations';
    console.log(`Fetching example for ${pkg}...`);
    const code = await getExampleCode(pkg);
    if (code) {
        console.log('--- Code Start ---');
        console.log(code.substring(0, 500) + '...'); // Print first 500 chars
        console.log('--- Code End ---');
    } else {
        console.log('Failed to fetch code.');
    }
}

test();
