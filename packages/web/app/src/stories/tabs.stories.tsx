import { MouseEvent, useCallback, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof Template> = {
  title: 'Components/Tabs',
  component: Template,
  argTypes: {
    variant: {
      control: { type: 'inline-radio' },
      options: ['default', 'menu'],
    },
    tabs: {
      control: { type: 'object' },
    },
  },
  args: {
    tabs: ['Overview', 'Members', 'Policy', 'Settings', 'Support', 'Subscription'],
    variant: 'default',
  },
};

export default meta;

type Story = StoryObj<typeof Template>;

function Template({ tabs, variant }: { tabs: string[]; variant: 'default' | 'menu' }) {
  const [page, setPage] = useState(tabs[0]);

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setPage(event.currentTarget.dataset.value!);
  }, []);

  return (
    <Tabs value={page}>
      <TabsList variant={variant}>
        {tabs.map(value => (
          <TabsTrigger
            key={value}
            variant={variant}
            onClick={handleClick}
            value={value}
            data-value={value}
          >
            {value}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(value => (
        <TabsContent key={value} variant={variant} value={value}>
          {value} Tab Content
        </TabsContent>
      ))}
    </Tabs>
  );
}

export const Default: Story = {};

export const Menu: Story = {
  args: {
    variant: 'menu',
  },
};
