import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';

// Define variants for TabsList
const tabsListVariants = cva('relative flex items-center', {
  variants: {
    variant: {
      default:
        'bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1',
      menu: 'text-gray-700',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

// Define variants for TabsTrigger
const tabsTriggerVariants = cva('cursor-pointer !appearance-none text-sm font-medium transition', {
  variants: {
    variant: {
      default:
        'ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 data-[state=active]:shadow-sm disabled:cursor-not-allowed active:disabled:pointer-events-none',
      menu: 'text-white radix-state-active:border-b-orange-500 border-b-2 border-b-transparent px-4 py-3 hover:border-b-orange-900',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

// Define variants for TabsContent
const tabsContentVariants = cva(
  'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'py-7',
        menu: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerVariants> & { hasBorder?: boolean }
>(({ className, variant, hasBorder = true, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), hasBorder, className)}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> &
    VariantProps<typeof tabsContentVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(tabsContentVariants({ variant }), className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
