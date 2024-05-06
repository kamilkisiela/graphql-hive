import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import RSS from 'rss';

type Meta = {
  title: string;
  date: string;
  url: string;
  description: string;
};

async function generateRSS() {
  const __dirname = path.resolve(path.dirname(''));
  const feed = new RSS({
    title: 'Hive Changelog',
    site_url: 'https://the-guild.dev/graphql/hive',
    feed_url: 'https://the-guild.dev/graphql/hive/feed.xml',
  });

  const allChangelogs = await fs.readdir(
    path.join(__dirname, '..', 'docs', 'src', 'pages', 'product-updates'),
  );
  const allChangelogsPosts = [] as Meta[];
  await Promise.all(
    allChangelogs.map(async name => {
      if (name.startsWith('index.') || name.startsWith('_meta.') || name.startsWith('_')) return;

      const content = await fs.readFile(
        path.join(__dirname, '..', 'docs', 'src', 'pages', 'product-updates', name),
      );
      const frontmatter = matter(content);

      allChangelogsPosts.push({
        title: frontmatter.data.title,
        date: frontmatter.data.date,
        url: `https://the-guild.dev/graphql/hive/product-updates/${name.replace(/\.mdx$/, '')}`,
        description: frontmatter.data.description,
      });
    }),
  );

  allChangelogsPosts.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  allChangelogsPosts.forEach(post => {
    feed.item(post);
  });
  await fs.writeFile('./public/feed.xml', feed.xml({ indent: true }));
}

try {
  generateRSS();
  console.log('✅  RSS generated');
} catch (e) {
  console.error(e);
  process.exit(1);
}
