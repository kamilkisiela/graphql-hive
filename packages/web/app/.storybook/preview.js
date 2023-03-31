import '../public/styles.css';

console.log('[dark]');
if (!document.body.className.includes('dark')) {
  console.log('[dark] added');
  document.body.className += ' ' + 'dark';
}

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
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
