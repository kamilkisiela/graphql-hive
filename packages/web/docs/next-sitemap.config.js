/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl: process.env.SITE_URL || 'https://graphql-hive.com',
  generateIndexSitemap: false,
  output: 'export',
};
