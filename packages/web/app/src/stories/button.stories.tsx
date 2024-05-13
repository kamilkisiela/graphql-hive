import { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Button> = {
    title: 'Components/Button',
    component: Button,
    decorators: [
        (Story: any) => (
            <div className='flex flex-row w-full'>
                <div className="flex flex-row w-full p-2 bg-white h-screen items-center">
                    <Story />
                </div>
                <div className="flex flex-row w-full p-2 bg-black h-screen items-center">
                    <Story />
                </div>
            </div>
        ),
    ],
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['default', 'primary', 'secondary', 'destructive', 'link'],
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

export const Primary: Story = {
    args: {
        variant: 'primary',
        children: 'Primary Button',
    },
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
        children: 'Secondary Button',
    },
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
        children: 'Destructive Button',
    },
};

export const Link: Story = {
    args: {
        variant: 'link',
        children: 'Link Button',
    },
};

// Sizes
export const SizeDefault: Story = {
    args: {
        size: 'default',
        children: 'Default Size',
    },
};

export const SizeSmall: Story = {
    args: {
        size: 'sm',
        children: 'Small Size',
    },
};

export const SizeLarge: Story = {
    args: {
        size: 'lg',
        children: 'Large Size',
    },
};


