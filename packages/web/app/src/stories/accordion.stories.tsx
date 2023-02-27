import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Accordion } from '../components/v2/accordion';

const meta: Meta<typeof Accordion> = {
  title: 'Accordion',
  component: Accordion,
};

export default meta;
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: () => (
    <div className="bg-white p-5">
      <Accordion>
        <Accordion.Item value="First">
          <Accordion.Header>First</Accordion.Header>
          <Accordion.Content>First</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="Second">
          <Accordion.Header>Second</Accordion.Header>
          <Accordion.Content>Second</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="Third">
          <Accordion.Header>Third</Accordion.Header>
          <Accordion.Content>Third</Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  ),
};

export const Dynamic: Story = {
  render: () => {
    const [list, setList] = useState(['Tab #1', 'Tab #2', 'Tab #3']);
    return (
      <div className="bg-white p-5">
        <Accordion>
          {list.map(tab => (
            <Accordion.Item key={tab} value={tab}>
              <Accordion.Header>{tab}</Accordion.Header>
              <Accordion.Content>{tab} content</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion>
        <button className="mt-6" onClick={() => setList(l => l.concat([`Tab #${l.length + 1}`]))}>
          Add
        </button>
      </div>
    );
  },
};
