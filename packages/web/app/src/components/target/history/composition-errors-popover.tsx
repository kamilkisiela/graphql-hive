import { InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button/button';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';

export function CompositionErrorsPopover() {
  return (
    <Popover
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="About composition errors"
          data-cy="composition-errors-info"
        >
          <InfoIcon className="size-3" />
        </Button>
      }
      openOnHover
      width="lg"
      content={
        <div>
          <p className="text-xs text-fg-default">
            If composition errors occur it is impossible to generate a supergraph and public API
            schema.
          </p>
          <p className="mt-2 text-xs text-fg-default">
            Composition errors can be caused by changes to the underlying subgraphs that causes
            conflicts with other subgraphs.
          </p>
        </div>
      }
    />
  );
}
