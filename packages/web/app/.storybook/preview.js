import '../src/index.css';

//  Exposes environment variables to the frontend as a JavaScript object.
window.__ENV ||= {
  ENVIRONMENT: 'development',
  APP_BASE_URL: 'http://localhost:3000',
  GRAPHQL_PUBLIC_ENDPOINT: 'http://localhost:3001/graphql',
  GRAPHQL_PUBLIC_SUBSCRIPTION_ENDPOINT: 'http://localhost:3001/graphql',
  GRAPHQL_PUBLIC_ORIGIN: 'http://localhost:3001',
};

if (!document.body.classList.contains('dark')) {
  document.body.classList.add('dark');
}

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    backgrounds: {
      default: 'black',
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
