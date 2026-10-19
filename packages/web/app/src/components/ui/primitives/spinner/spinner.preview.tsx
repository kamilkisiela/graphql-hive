import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { DataTableCursorPagination } from '@/components/ui/data-table/data-table-pagination';
import { Button } from '../button/button';
import { Spinner } from './spinner';

export const nav: NavPath = 'Primitives/Spinner';

export const Sizes = createPreview(() => (
  <div className="flex items-end gap-8 text-xs text-fg-secondary">
    <span className="flex flex-col items-center gap-2">
      <Spinner variants={{ size: 'sm' }} />
      sm
    </span>
    <span className="flex flex-col items-center gap-2">
      <Spinner />
      default
    </span>
    <span className="flex flex-col items-center gap-2">
      <Spinner variants={{ size: 'lg' }} />
      lg
    </span>
  </div>
));

export const InContext = createPreview(() => (
  <div className="flex flex-col gap-6 text-sm">
    <div className="flex h-24 items-center justify-center rounded-md border border-line text-center">
      <Spinner />
    </div>
    <DataTableCursorPagination
      loading
      summary="Showing 20 of 143 deployments"
      hasPreviousPage
      hasNextPage
      onPrevious={() => {}}
      onNext={() => {}}
    />
    <div className="flex flex-col items-center">
      <Spinner />
      <div className="mt-2 text-xs">Loading app deployments</div>
    </div>
  </div>
));

export const InButton = createPreview(() => (
  <div className="flex items-center gap-4">
    <Button>
      <Spinner variants={{ size: 'sm', tone: 'current' }} />
      Creating...
    </Button>
    <Button variant="outline">
      <Spinner variants={{ size: 'sm', tone: 'current' }} />
      Save Changes
    </Button>
    <Button variant="primary">
      <Spinner variants={{ size: 'sm', tone: 'current' }} />
      Submit Proposal
    </Button>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Spinner, {
    label: { type: 'text', default: 'Loading' },
    variants: {
      size: { type: 'radio', options: ['sm', 'default', 'lg'], default: 'default' },
      tone: { type: 'radio', options: ['accent', 'current'], default: 'accent' },
    },
  }),
  render: v => <Spinner label={v.label} variants={v.variants} />,
});
