import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NavLayout, PageLayout, PageLayoutContent } from '@/components/ui/page-content-layout';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/Sub page layout',
  component: PageLayout,
};

export default meta;

const subPages = [
  { key: 'general', title: 'General' },
  { key: 'cdn', title: 'CDN Tokens' },
  { key: 'registry-token', title: 'Registry Tokens' },
  { key: 'breaking-changes', title: 'Breaking Changes' },
  { key: 'base-schema', title: 'Base Schema' },
  { key: 'schema-contracts', title: 'Schema Contracts' },
];

const Template: StoryObj<typeof PageLayout> = {
  render: () => {
    const [page, setPage] = useState('general');

    return (
      <PageLayout>
        <NavLayout>
          {subPages.map(subPage => {
            return (
              <Button
                key={subPage.key}
                variant="ghost"
                onClick={() => setPage(subPage.key)}
                className={
                  page === subPage.key
                    ? 'bg-muted hover:bg-muted'
                    : 'hover:bg-transparent hover:underline'
                }
              >
                {subPage.title}
              </Button>
            );
          })}
        </NavLayout>
        <PageLayoutContent mainTitlePage={subPages.find(subPage => subPage.key === page)?.title}>
          {page === 'general' && <div className="flex flex-col gap-10">General</div>}
          {page === 'cdn' && <div>CDN Tokens</div>}
          {page === 'registry-token' && <div>Registry Tokens</div>}
          {page === 'breaking-changes' && <div>Breaking Changes</div>}
          {page === 'base-schema' && <div>Base Schema</div>}
          {page === 'schema-contracts' && <div>Schema Contracts</div>}
        </PageLayoutContent>
      </PageLayout>
    );
  },
};

export const Default = Template;
