import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const productUpdatesDirectory = '../../../packages/web/docs/src/pages/product-updates';
function generateChangelogs() {
  const files = fs.readdirSync(productUpdatesDirectory);
  const changelogs = [];

  for (const file of files) {
    if (file.endsWith('.json') || file.endsWith('index.mdx')) {
      continue;
    }

    const filePath = path.join(productUpdatesDirectory, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    if (data.title && data.date) {
      changelogs.push({
        date: new Date(data.date).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        userReadItem: false,
        href: `https://the-guild.dev/graphql/hive/product-updates/${file.replace('.mdx', '')}`,
        title: data.title,
        description: data.description || '',
      });
    }
  }

  // Sort changelogs by date and get the latest 4 records
  const latestChangelogs = changelogs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  // Generate a TypeScript file with the latest changelogs
  const outputFilePath =
    '../../../packages/web/app/src/components/ui/changelog/generated-changelogs.ts';
  const outputContent = `export const latestChangelogs = ${JSON.stringify(latestChangelogs, null, 2)};\n`;
  fs.writeFileSync(outputFilePath, outputContent, 'utf-8');

  console.log(`Changelogs generated successfully at: ${outputFilePath}`);
}

generateChangelogs();
