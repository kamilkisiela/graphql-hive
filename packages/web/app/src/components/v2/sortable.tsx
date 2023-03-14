import { ComponentProps, ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Tooltip } from '@/components/v2/tooltip';
import { TriangleUpIcon } from '@radix-ui/react-icons';
import { SortDirection } from '@tanstack/react-table';

export function Sortable({
  children,
  sortOrder,
  onClick,
}: {
  children: ReactNode;
  sortOrder: SortDirection | false;
  onClick: ComponentProps<'button'>['onClick'];
}): ReactElement {
  const tooltipText =
    sortOrder === false
      ? 'Click to sort descending'
      : {
          asc: 'Click to cancel sorting',
          desc: 'Click to sort ascending',
        }[sortOrder];

  return (
    <Tooltip content={tooltipText}>
      <button className="flex gap-2 items-center justify-center" onClick={onClick}>
        {children}

        <span>
          <TriangleUpIcon className={clsx(sortOrder === 'asc' && 'text-orange-500')} />
          <TriangleUpIcon
            className={clsx('rotate-180', sortOrder === 'desc' && 'text-orange-500')}
          />
        </span>
      </button>
    </Tooltip>
  );
}
