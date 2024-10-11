// eslint-disable-next-line import/no-extraneous-dependencies
import RSS from 'rss';
import { getChangelogs } from '../../components/product-updates';

export async function GET() {
  const feed = new RSS({
    title: 'Hive Changelog',
    site_url: 'https://the-guild.dev/graphql/hive',
    feed_url: 'https://the-guild.dev/graphql/hive/feed.xml',
  });

  for (const item of await getChangelogs()) {
    feed.item({
      title: item.title,
      date: item.date,
      url: `https://the-guild.dev/graphql/hive${item.route}`,
      description: item.description,
    });
  }

  return new Response(feed.xml({ indent: true }), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
