import { cva } from 'class-variance-authority';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SupportTicketPriority, SupportTicketStatus } from '@/gql/graphql';
import { cn } from '@/lib/utils';

const statusVariants = cva('inline-flex items-center text-sm font-semibold', {
  variants: {
    variant: {
      [SupportTicketStatus.Open]: 'text-yellow-400',
      [SupportTicketStatus.Solved]: 'text-gray-500',
    },
  },
  defaultVariants: {
    variant: SupportTicketStatus.Open,
  },
});

export const statusDescription: Record<SupportTicketStatus, string> = {
  [SupportTicketStatus.Open]: 'Staff is working on the ticket	',
  [SupportTicketStatus.Solved]: 'The ticket has been solved',
};

export function Status({ className, status }: { status: SupportTicketStatus; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className={cn(statusVariants({ variant: status }), className)}>
          <div>{status}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{statusDescription[status]}</TooltipContent>
    </Tooltip>
  );
}

const priorityVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        [SupportTicketPriority.Normal]:
          'border-transparent bg-destructive/40 text-destructive-foreground',
        [SupportTicketPriority.High]:
          'border-transparent bg-destructive/60 text-destructive-foreground',
        [SupportTicketPriority.Urgent]:
          'border-transparent bg-destructive/80 text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: SupportTicketPriority.Normal,
    },
  },
);

export const priorityDescription: Record<SupportTicketPriority, string> = {
  [SupportTicketPriority.Normal]: 'Minor business impact or general questions',
  [SupportTicketPriority.High]: 'Major business impact',
  [SupportTicketPriority.Urgent]: 'Critical business impact',
};

export function Priority({
  className,
  level,
}: {
  level: SupportTicketPriority;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className={cn(priorityVariants({ variant: level }), className)}>{level}</div>
      </TooltipTrigger>
      <TooltipContent>{priorityDescription[level]}</TooltipContent>
    </Tooltip>
  );
}
