import { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { Slider } from '../components/ui/slider';


const meta: Meta<typeof Template> = {
    title: 'Components/Slider',
    component: Template,
    argTypes: {
        min: {
            control: 'number',
            defaultValue: 0,
        },
        max: {
            control: 'number',
            defaultValue: 100,
        },
        step: {
            control: 'number',
            defaultValue: 1,
        },
        disabled: {
            control: 'boolean',
            defaultValue: false,
        },
    },
    args: {
        min: 0,
        max: 100,
        step: 1,
    }
};

export default meta;

type Story = StoryObj<typeof Template>

function Template({ min, max, step, disabled }: { min: number, max: number, step: number, disabled: boolean }) {
    useEffect(() => {
        console.log('min, max, or step changed');
    }, [min, max, step, disabled]);

    return (
        <div className='w-1/2 mx-auto'>
            <Slider
                min={min}
                max={max}
                step={step}
                disabled={disabled}
            />
        </div>
    );
}

export const Default: Story = {
    args: {
        min: 1,
        step: 10,
        max: 100,
        disabled: true,
    }
};
