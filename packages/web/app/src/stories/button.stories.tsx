import { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Button> = {
    title: 'Components/Button',
    component: Button,
    decorators: [
        (Story: any) => (
            <div className='flex flex-row w-full bg-black'>
                <div className="flex flex-row w-full p-2 h-screen items-center">
                    <Story />
                </div>
            </div>
        ),
    ],
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        },
        size: {
            control: { type: 'select' },
            options: ['default', 'sm', 'lg'],
        },
    },
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
    args: {
        variant: 'default',
        children: 'Default Button',
    },
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
        children: 'Destructive Button',
    },
};

export const Outline: Story = {
    args: {
        variant: 'outline',
        children: 'Outline Button',
    },
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
        children: 'Secondary Button',
    },
};

export const Ghost: Story = {
    args: {
        variant: 'ghost',
        children: 'Ghost Button',
    },
};

export const Link: Story = {
    args: {
        variant: 'link',
        children: 'Link Button',
    },
};


