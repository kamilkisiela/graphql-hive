import { DocsLink, DocsNote, ProductUpdatesLink } from '@/components/ui/docs-note';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Components/Docs Components',
  component: DocsNote, // Adjust if you have separate stories for each component
};

export default meta;

type DocsNoteStory = StoryObj<typeof DocsNote>;
type DocsLinkStory = StoryObj<typeof DocsLink>;
type ProductUpdatesLinkStory = StoryObj<typeof ProductUpdatesLink>;

export const DocsNoteDefault: DocsNoteStory = {
  render: () => <DocsNote>This is a standard documentation note.</DocsNote>,
};

export const DocsNoteWarning: DocsNoteStory = {
  render: () => <DocsNote warn>This is a warning documentation note.</DocsNote>,
};

export const DocsLinkDefault: DocsLinkStory = {
  render: () => <DocsLink href="getting-started">Getting Started Guide</DocsLink>,
};

export const ProductUpdatesLinkDefault: ProductUpdatesLinkStory = {
  render: () => <ProductUpdatesLink href="release-notes">Release Notes</ProductUpdatesLink>,
};
