import { XCircleIcon } from 'lucide-react';
import { FragmentType, useFragment } from '@/gql';
import { CompositionErrorMessage } from './composition-error-message';
import { CompositionErrorsPopover } from './composition-errors-popover';
import { CompositionErrorsSection_SchemaErrorConnection } from './errors-and-changes';

export function CompositionErrorsCard(props: {
  compositionErrors: FragmentType<typeof CompositionErrorsSection_SchemaErrorConnection>;
}) {
  const compositionErrors = useFragment(
    CompositionErrorsSection_SchemaErrorConnection,
    props.compositionErrors,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-critical-line">
      <div className="flex items-start gap-3 border-b border-critical-line bg-critical-tint-subtle px-5 py-4">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-critical-line">
          <XCircleIcon className="h-4 w-4 text-critical" />
        </div>

        <div className="min-w-0 text-fg">
          <h3 className="text-sm font-semibold">Supergraph not composable</h3>
          <p className="mt-0.5 text-[12.5px]">
            Errors occurred while attempting to compose the supergraph from its subgraphs.
          </p>
        </div>

        <span className="ml-auto inline-flex items-center rounded-full border border-critical-line bg-critical-tint px-2.5 py-0.5 text-2xs font-semibold text-critical-text transition-colors focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-critical" />
          {compositionErrors.edges.length} error
          {compositionErrors.edges.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-center gap-2 px-5 pt-4 pb-1 text-fg">
        <span className="text-sm font-medium">Composition errors</span>
        <CompositionErrorsPopover />
      </div>

      <ul className="divide-y divide-critical-line-subtle px-1 pb-2">
        {compositionErrors.edges.map((err, idx) => (
          <li key={idx} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-critical select-none">
              {String(idx + 1).padStart(2, '0')}
            </span>

            <CompositionErrorMessage message={err.node.message} />
          </li>
        ))}
      </ul>
    </div>
  );
}
