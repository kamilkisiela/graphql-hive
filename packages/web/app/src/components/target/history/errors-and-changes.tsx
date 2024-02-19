import { ReactElement, useMemo } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { CheckIcon } from 'lucide-react';
import reactStringReplace from 'react-string-replace';
import { Label, Label as LegacyLabel } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Heading } from '@/components/v2';
import { PulseIcon } from '@/components/v2/icon';
import { Tooltip as LegacyTooltip } from '@/components/v2/tooltip';
import { FragmentType, graphql, useFragment } from '@/gql';
import { CriticalityLevel, SchemaChangeFieldsFragment } from '@/graphql';
import { formatNumber } from '@/lib/hooks';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { CheckCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons';

export function labelize(message: string) {
  // Turn " into '
  // Replace '...' with <Label>...</Label>
  return reactStringReplace(message.replace(/"/g, "'"), /'([^']+)'/gim, (match, i) => {
    return <Label key={i}>{match}</Label>;
  });
}

const criticalityLevelMapping = {
  [CriticalityLevel.Safe]: clsx('text-emerald-400'),
  [CriticalityLevel.Dangerous]: clsx('text-yellow-400'),
} as Record<CriticalityLevel, string>;

export function ChangesBlock(props: {
  title: string | React.ReactElement;
  criticality: CriticalityLevel;
  retentionInDays?: number;
  changes: SchemaChangeFieldsFragment[];
}): ReactElement | null {
  const router = useRouteSelector();

  return (
    <div>
      <h2 className="mb-3 font-bold text-gray-900 dark:text-white">{props.title}</h2>
      <ul className="list-inside list-disc space-y-2 pl-3 text-sm leading-relaxed">
        {props.changes.map((change, key) => (
          <li
            key={key}
            className={clsx(
              (!!change.approval && 'text-orange-500') ||
                (criticalityLevelMapping[props.criticality] ?? 'text-red-400'),
              ' my-1 flex space-x-2',
            )}
          >
            <MaybeWrapTooltip tooltip={change.criticalityReason ?? null}>
              <span className="text-gray-600 dark:text-white">{labelize(change.message)}</span>
            </MaybeWrapTooltip>
            {change.isSafeBasedOnUsage && (
              <span className="cursor-pointer text-yellow-500">
                {' '}
                <CheckIcon className="inline size-3" /> Safe based on usage data
              </span>
            )}
            {change.usageStatistics ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="flex cursor-help items-center space-x-1 rounded-sm bg-gray-800 px-2 font-bold">
                      <PulseIcon className="h-6 stroke-[1px]" />
                      <span className="text-xs">
                        {change.usageStatistics.topAffectedOperations.length}
                        {change.usageStatistics.topAffectedOperations.length > 10 ? '+' : ''}{' '}
                        {change.usageStatistics.topAffectedOperations.length === 1
                          ? 'operation'
                          : 'operations'}{' '}
                        by {change.usageStatistics.topAffectedClients.length}{' '}
                        {change.usageStatistics.topAffectedClients.length === 1
                          ? 'client'
                          : 'clients'}{' '}
                        affected
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="mb-2 w-full text-base font-bold">
                      Usage based on conditional breaking change configuration
                    </div>
                    <div className="flex space-x-4">
                      <Table>
                        <TableCaption>Top 10 affected operations.</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[150px]">Operation Name</TableHead>
                            <TableHead>Total Requests</TableHead>
                            <TableHead className="text-right">% of traffic</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {change.usageStatistics.topAffectedOperations.map(
                            ({ hash, name, count, percentage }) => (
                              <TableRow key={hash}>
                                <TableCell className="font-medium">
                                  <Link
                                    className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-2"
                                    href={{
                                      pathname:
                                        '/[organizationId]/[projectId]/[targetId]/insights/[operationName]/[operationHash]',
                                      query: {
                                        organizationId: router.organizationId,
                                        projectId: router.projectId,
                                        targetId: router.targetId,
                                        operationName: `${hash.substring(0, 4)}_${name}`,
                                        operationHash: hash,
                                        period: `${props.retentionInDays || 7}d`,
                                      },
                                    }}
                                  >
                                    {hash.substring(0, 4)}_{name}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-right">{formatNumber(count)}</TableCell>
                                <TableCell className="text-right">{percentage}%</TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                      <Table>
                        <TableCaption>Top 10 affected clients.</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[150px]">Client Name</TableHead>
                            <TableHead>Total Requests</TableHead>
                            <TableHead className="text-right">% of traffic</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {change.usageStatistics.topAffectedClients.map(
                            ({ name, count, percentage }) => (
                              <TableRow key={name}>
                                <TableCell className="font-medium">{name}</TableCell>
                                <TableCell className="text-right">{formatNumber(count)}</TableCell>
                                <TableCell className="text-right font-bold">
                                  {percentage}%
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 border-t border-t-gray-700 pt-2 text-xs text-gray-100">
                      <span>
                        See{' '}
                        <Link
                          className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-2"
                          href={{
                            pathname:
                              '/[organizationId]/[projectId]/[targetId]/insights/schema-coordinate/[coordinate]',
                            query: {
                              organizationId: router.organizationId,
                              projectId: router.projectId,
                              targetId: router.targetId,
                              coordinate: change.path?.join('.'),
                              period: `${props.retentionInDays || 7}d`,
                            },
                          }}
                        >
                          Insights
                        </Link>{' '}
                        for live usage data.
                      </span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {change.approval ? <SchemaChangeApproval approval={change.approval} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SchemaChangeApproval = (props: {
  approval: Exclude<SchemaChangeFieldsFragment['approval'], null | undefined>;
}) => {
  const approvalName = props.approval.approvedBy?.displayName ?? '<unknown>';
  const approvalDate = useMemo(
    () => format(new Date(props.approval.approvedAt), 'do MMMM yyyy'),
    [props.approval.approvedAt],
  );
  const route = useRouteSelector();
  // eslint-disable-next-line no-restricted-syntax
  const schemaCheckPath = useMemo(
    () =>
      '/' +
      [
        route.organizationId,
        route.projectId,
        route.targetId,
        'checks',
        props.approval.schemaCheckId,
      ].join('/'),
    [],
  );

  return (
    <LegacyTooltip.Provider delayDuration={200}>
      <LegacyTooltip
        content={
          <>
            This breaking change was manually{' '}
            {props.approval.schemaCheckId === route.schemaCheckId ? (
              <>
                {' '}
                approved by {approvalName} in this check on {approvalDate}.
              </>
            ) : (
              <Link href={schemaCheckPath} className="text-orange-500 hover:underline">
                approved by {approvalName} on {approvalDate}.
              </Link>
            )}
          </>
        }
      >
        <span className="cursor-pointer text-green-500">
          {' '}
          <CheckIcon className="inline size-3" /> Approved by {approvalName}
        </span>
      </LegacyTooltip>
    </LegacyTooltip.Provider>
  );
};

function MaybeWrapTooltip(props: { children: React.ReactNode; tooltip: string | null }) {
  return props.tooltip ? (
    <LegacyTooltip.Provider delayDuration={200}>
      <LegacyTooltip content={props.tooltip}>{props.children}</LegacyTooltip>
    </LegacyTooltip.Provider>
  ) : (
    <>{props.children}</>
  );
}

const CompositionErrorsSection_SchemaErrorConnection = graphql(`
  fragment CompositionErrorsSection_SchemaErrorConnection on SchemaErrorConnection {
    nodes {
      message
    }
  }
`);

export function CompositionErrorsSection(props: {
  compositionErrors: FragmentType<typeof CompositionErrorsSection_SchemaErrorConnection>;
}) {
  const compositionErrors = useFragment(
    CompositionErrorsSection_SchemaErrorConnection,
    props.compositionErrors,
  );

  return (
    <div className="mb-2 px-2">
      <TooltipProvider>
        <Heading className="my-2">
          Composition Errors
          <Tooltip>
            <TooltipTrigger>
              <Button variant="ghost" size="icon-sm" className="ml-2">
                <InfoCircledIcon className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-md p-4 font-normal">
              <p>
                If composition errors occur it is impossible to generate a supergraph and public API
                schema.
              </p>
              <p className="mt-1">
                Composition errors can be caused by changes to the underlying schemas that causes
                conflicts with other subgraphs.
              </p>
            </TooltipContent>
          </Tooltip>
        </Heading>
      </TooltipProvider>
      <ul>
        {compositionErrors?.nodes.map((change, index) => (
          <li key={index} className="mb-1 ml-[1.25em] list-[square] pl-0 marker:pl-1">
            <CompositionError message={change.message} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompositionError(props: { message: string }) {
  return reactStringReplace(
    reactStringReplace(
      reactStringReplace(props.message, /"([^"]+)"/g, (match, index) => {
        return <LegacyLabel key={match + index}>{match}</LegacyLabel>;
      }),
      /(@[^. ]+)/g,
      (match, index) => {
        return <LegacyLabel key={match + index}>{match}</LegacyLabel>;
      },
    ),
    /Unknown type ([A-Za-z_0-9]+)/g,
    (match, index) => {
      return (
        <span key={match + index}>
          Unknown type <LegacyLabel>{match}</LegacyLabel>
        </span>
      );
    },
  );
}

export function NoGraphChanges() {
  return (
    <div className="cursor-default">
      <div className="mb-3 flex items-center gap-3">
        <CheckCircledIcon className="h-4 w-auto text-emerald-500" />
        <h2 className="text-base font-medium text-white">No Graph Changes</h2>
      </div>
      <p className="text-muted-foreground text-xs">
        There are no changes in this graph for this graph.
      </p>
    </div>
  );
}
