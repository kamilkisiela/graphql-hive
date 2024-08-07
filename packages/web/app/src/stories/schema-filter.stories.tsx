import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Meta, StoryObj } from '@storybook/react';

type CompositeSchema = {
  id: string;
  service: string;
  url?: string;
};

const meta: Meta<typeof Popover> = {
  title: 'Components/Schema Filter',
  component: Popover,
};

export default meta;

type Story = StoryObj<typeof Popover>;

const Template = () => {
  const [open, setOpen] = useState(false);
  const [filterService, setFilterService] = useState('');
  const [term, setTerm] = useState('');

  const handleChange = (value: string) => {
    setFilterService(value);
    setTerm(value);
    setOpen(false);
  };

  const reset = () => {
    setFilterService('');
    setTerm('');
  };

  const compositeSchemas: CompositeSchema[] = [
    { id: '1', service: 'User Service' },
    { id: '2', service: 'Product Service' },
    { id: '3', service: 'Order Service' },
    { id: '4', service: 'Payment Service' },
  ];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-[400px] justify-between">
            {filterService
              ? compositeSchemas?.find(schema => schema.service === filterService)?.service
              : 'Filter schema'}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] truncate p-0">
          <Command>
            <CommandInput
              closeFn={reset}
              className="w-[400px]"
              placeholder="Search schema"
              value={term}
              onValueChange={setTerm}
            />
            <CommandEmpty>No schema found.</CommandEmpty>
            <CommandGroup>
              {compositeSchemas?.map(schema => (
                <CommandItem
                  key={schema.service}
                  value={schema.service}
                  onSelect={() => handleChange(schema.service)}
                >
                  <Check
                    className={cn('mr-2 size-4', term === schema.id ? 'opacity-100' : 'opacity-0')}
                  />
                  {schema.service}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
};

export const Default: Story = {
  name: 'Default',
  render: Template,
};
