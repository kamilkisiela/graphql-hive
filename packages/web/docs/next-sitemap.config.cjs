/* eslint-disable no-undef, no-process-env */
/** @type {import('next-sitemap').IConfig} */

module.exports = {
  siteUrl: process.env.SITE_URL || 'https://graphql-hive.com',
  generateIndexSitemap: false,
};
