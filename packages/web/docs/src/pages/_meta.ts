export default {
  index: {
    title: 'Home',
    type: 'page',
    display: 'hidden',
    theme: {
      layout: 'raw',
    },
  },
  hive: {
    title: 'Dashboard',
    type: 'page',
    href: 'https://app.graphql-hive.com',
    newWindow: true,
  },
  status: {
    title: 'Status',
    type: 'page',
    href: 'https://status.graphql-hive.com',
    newWindow: true,
  },
  docs: {
    title: 'Documentation',
    type: 'page',
    theme: {
      toc: true,
    },
  },
  'product-updates': {
    type: 'page',
    title: 'Product Updates',
    theme: {
      sidebar: false,
      toc: true,
      breadcrumb: false,
      typesetting: 'article',
    },
  },
};
