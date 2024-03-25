/// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const productUpdatesDirectory = path.join(
  __dirname,
  '../packages/web/docs/src/pages/product-updates',
);

const files = fs.readdirSync(productUpdatesDirectory);
const changelogRecords = [];

for (const file of files) {
  if (!file.endsWith('.mdx') || file.endsWith('index.mdx')) {
    continue;
  }

  const filePath = path.join(productUpdatesDirectory, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(content);

  if (data.title && data.date) {
    changelogRecords.push({
      date: new Date(data.date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      href: `https://the-guild.dev/graphql/hive/product-updates/${file.replace('.mdx', '')}`,
      title: data.title,
      description: data.description || '',
    });
  }
}

// Sort changelogs by date and get the latest 4 records
const latestChangelog = changelogRecords
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 4);

// Generate a TypeScript file with the latest changelogs
const outputFilePath = path.join(
  __dirname,
  '../packages/web/app/src/components/ui/changelog/generated-changelog.ts',
);
const outputContent = `export const latestChangelog = ${JSON.stringify(latestChangelog, null, 2)};\n`;
fs.writeFileSync(outputFilePath, outputContent, 'utf-8');

console.log(`Generated successfully at: ${outputFilePath}`);
