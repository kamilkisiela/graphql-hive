import { BlocksIcon, BoxIcon, FoldVerticalIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { RadioGroup } from '@/components/ui/radio-group';
import { ProjectTypeCard } from '@/components/v2/modals/create-project';
import { ProjectType } from '@/gql/graphql';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof RadioGroup> = {
  title: 'Components/RadioGroup',
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof RadioGroup>;

const Template = () => {
  const form = useForm();

  return (
    <Form {...form}>
      <RadioGroup className="inline-flex flex-col">
        <ProjectTypeCard
          type={ProjectType.Single}
          title="Single"
          description="Monolithic GraphQL schema developed as a standalone"
          icon={<BoxIcon />}
        />
        <ProjectTypeCard
          type={ProjectType.Federation}
          title="Federation"
          description="Project developed according to Apollo Federation specification"
          icon={<BlocksIcon />}
        />
        <ProjectTypeCard
          type={ProjectType.Stitching}
          title="Stitching"
          description="Project that stitches together multiple GraphQL APIs"
          icon={<FoldVerticalIcon />}
        />
      </RadioGroup>
    </Form>
  );
};

export const Default: Story = {
  name: 'Default',
  render: Template,
};
