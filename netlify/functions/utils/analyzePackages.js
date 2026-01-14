import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'top_packages.json');
const OUTPUT_PATH = path.join(__dirname, 'package_analysis.json');

async function analyzePackages() {
    try {
        console.log('Reading top_packages.json...');
        const data = JSON.parse(await fs.readFile(DATA_PATH, 'utf-8'));

        console.log(`Working with ${data.length} packages.`);

        const packageList = data.map(p => ({
            name: p.packageName,
            tags: p.tags || [],
            apiTags: p.apiTags || [],
            description: p.description
        }));

        // 태그 빈도 분석
        const tagCount = {};
        packageList.forEach(p => {
            p.tags.forEach(tag => {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
            });
        });

        const sortedTags = Object.entries(tagCount)
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));

        const analysis = {
            totalPackages: data.length,
            topTags: sortedTags.slice(0, 50),
            packages: packageList.map(p => p.name).sort()
        };

        await fs.writeFile(OUTPUT_PATH, JSON.stringify(analysis, null, 2));
        console.log(`Analysis saved to ${OUTPUT_PATH}`);

        // 간단한 요약 출력
        console.log('\n--- Top 20 Tags ---');
        sortedTags.slice(0, 20).forEach((t, i) => {
            console.log(`${i + 1}. ${t.tag}: ${t.count}`);
        });

    } catch (error) {
        console.error('Error analyzing packages:', error);
    }
}

analyzePackages();
