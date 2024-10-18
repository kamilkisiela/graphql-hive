import { ReactElement } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { CheckIcon } from 'lucide-react';
import reactStringReplace from 'react-string-replace';
import { Label, Label as LegacyLabel } from '@/components/common';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { PulseIcon } from '@/components/ui/icon';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { FragmentType, graphql, useFragment } from '@/gql';
import { CriticalityLevel } from '@/gql/graphql';
import { CheckCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Link } from '@tanstack/react-router';

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

const ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment = graphql(`
  fragment ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment on SchemaCheckConditionalBreakingChangeMetadata {
    settings {
      retentionInDays
      targets {
        name
        target {
          id
          slug
        }
      }
    }
  }
`);

const ChangesBlock_SchemaChangeApprovalFragment = graphql(`
  fragment ChangesBlock_SchemaChangeApprovalFragment on SchemaChangeApproval {
    approvedBy {
      id
      displayName
    }
    approvedAt
    schemaCheckId
  }
`);

const ChangesBlock_SchemaChangeWithUsageFragment = graphql(`
  fragment ChangesBlock_SchemaChangeWithUsageFragment on SchemaChange {
    path
    message(withSafeBasedOnUsageNote: false)
    criticality
    criticalityReason
    approval {
      ...ChangesBlock_SchemaChangeApprovalFragment
    }
    isSafeBasedOnUsage
    usageStatistics {
      topAffectedOperations {
        hash
        name
        countFormatted
        percentageFormatted
      }
      topAffectedClients {
        name
        countFormatted
        percentageFormatted
      }
    }
  }
`);

const ChangesBlock_SchemaChangeFragment = graphql(`
  fragment ChangesBlock_SchemaChangeFragment on SchemaChange {
    path
    message(withSafeBasedOnUsageNote: false)
    criticality
    criticalityReason
    approval {
      ...ChangesBlock_SchemaChangeApprovalFragment
    }
    isSafeBasedOnUsage
  }
`);

export function ChangesBlock(
  props: {
    title: string | React.ReactElement;
    criticality: CriticalityLevel;
    organizationSlug: string;
    projectSlug: string;
    targetSlug: string;
    schemaCheckId: string;
    conditionBreakingChangeMetadata?: FragmentType<
      typeof ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
    > | null;
  } & (
    | {
        changesWithUsage: FragmentType<typeof ChangesBlock_SchemaChangeWithUsageFragment>[];
        changes?: undefined;
      }
    | {
        changes: FragmentType<typeof ChangesBlock_SchemaChangeFragment>[];
        changesWithUsage?: undefined;
      }
  ),
): ReactElement | null {
  const changes = props.changesWithUsage ?? props.changes;

  return (
    <div>
      <h2 className="mb-3 font-bold text-gray-900 dark:text-white">{props.title}</h2>
      <div className="list-inside list-disc space-y-2 text-sm leading-relaxed">
        {changes.map((change, key) => (
          <ChangeItem
            organizationSlug={props.organizationSlug}
            projectSlug={props.projectSlug}
            targetSlug={props.targetSlug}
            schemaCheckId={props.schemaCheckId}
            key={key}
            change={change}
            conditionBreakingChangeMetadata={props.conditionBreakingChangeMetadata ?? null}
          />
        ))}
      </div>
    </div>
  );
}

// Obviously I'm not proud of this...
// But I didn't want to spend too much time on this
function isChangesBlock_SchemaChangeWithUsageFragment(
  fragment: any,
): fragment is FragmentType<typeof ChangesBlock_SchemaChangeWithUsageFragment> {
  return (
    !!fragment[' $fragmentRefs'] &&
    'ChangesBlock_SchemaChangeWithUsageFragment' in fragment[' $fragmentRefs']
  );
}

function ChangeItem(props: {
  change:
    | FragmentType<typeof ChangesBlock_SchemaChangeWithUsageFragment>
    | FragmentType<typeof ChangesBlock_SchemaChangeFragment>;
  conditionBreakingChangeMetadata: FragmentType<
    typeof ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
  > | null;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  schemaCheckId: string;
}) {
  const change = isChangesBlock_SchemaChangeWithUsageFragment(props.change)
    ? useFragment(ChangesBlock_SchemaChangeWithUsageFragment, props.change)
    : useFragment(ChangesBlock_SchemaChangeFragment, props.change);

  const metadata = useFragment(
    ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
    props.conditionBreakingChangeMetadata,
  );

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionHeader className="flex">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div
              className={clsx(
                (change.approval && 'text-orange-500') ||
                  (criticalityLevelMapping[change.criticality] ?? 'text-red-400'),
              )}
            >
              <div className="inline-flex justify-start space-x-2">
                <span className="text-left text-gray-600 dark:text-white">
                  {labelize(change.message)}
                </span>
                {change.isSafeBasedOnUsage && (
                  <span className="cursor-pointer text-yellow-500">
                    {' '}
                    <CheckIcon className="inline size-3" /> Safe based on usage data
                  </span>
                )}
                {'usageStatistics' in change && change.usageStatistics && (
                  <span className="flex items-center space-x-1 rounded-sm bg-gray-800 px-2 font-bold">
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
                )}
                {change.approval ? (
                  <div className="self-end">
                    <ApprovedByBadge approval={change.approval} />
                  </div>
                ) : null}
              </div>
            </div>
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent className="pb-8 pt-4">
          {change.approval && (
            <SchemaChangeApproval
              organizationSlug={props.organizationSlug}
              projectSlug={props.projectSlug}
              targetSlug={props.targetSlug}
              schemaCheckId={props.schemaCheckId}
              approval={change.approval}
            />
          )}
          {'usageStatistics' in change && change.usageStatistics && metadata ? (
            <div>
              <div className="flex space-x-4">
                <Table>
                  <TableCaption>Top 10 affected operations.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Operation Name</TableHead>
                      <TableHead className="text-right">Total Requests</TableHead>
                      <TableHead className="text-right">% of traffic</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {change.usageStatistics.topAffectedOperations.map(
                      ({ hash, name, countFormatted, percentageFormatted }) => (
                        <TableRow key={hash}>
                          <TableCell className="font-medium">
                            <Popover>
                              <PopoverTrigger className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-4">
                                {hash.substring(0, 4)}_{name}
                              </PopoverTrigger>
                              <PopoverContent side="right">
                                <div className="flex flex-col gap-y-2 text-sm">
                                  View live usage on
                                  {metadata.settings.targets.map((target, i) =>
                                    target.target ? (
                                      <p key={i}>
                                        <Link
                                          className="text-orange-500 hover:text-orange-500"
                                          to="/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash"
                                          params={{
                                            organizationSlug: props.organizationSlug,
                                            projectSlug: props.projectSlug,
                                            targetSlug: target.target.slug,
                                            operationName: `${hash.substring(0, 4)}_${name}`,
                                            operationHash: hash,
                                          }}
                                          target="_blank"
                                        >
                                          {target.name}
                                        </Link>{' '}
                                        <span className="text-white">target</span>
                                      </p>
                                    ) : null,
                                  )}
                                </div>
                                <PopoverArrow />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="text-right">{countFormatted}</TableCell>
                          <TableCell className="text-right">{percentageFormatted}</TableCell>
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
                      <TableHead className="text-right">Total Requests</TableHead>
                      <TableHead className="text-right">% of traffic</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {change.usageStatistics.topAffectedClients.map(
                      ({ name, countFormatted, percentageFormatted }) => (
                        <TableRow key={name}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell className="text-right">{countFormatted}</TableCell>
                          <TableCell className="text-right">{percentageFormatted}</TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex justify-end pt-2 text-xs text-gray-100">
                {metadata && (
                  <span>
                    See{' '}
                    {metadata.settings.targets.map((target, index, arr) => (
                      <>
                        {!target.target ? (
                          <TooltipProvider key={index}>
                            <Tooltip>
                              <TooltipTrigger>{target.name}</TooltipTrigger>
                              <TooltipContent>Target does no longer exist.</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Link
                            key={index}
                            className="text-orange-500 hover:text-orange-500"
                            to="/$organizationSlug/$projectSlug/$targetSlug/insights/schema-coordinate/$coordinate"
                            params={{
                              organizationSlug: props.organizationSlug,
                              projectSlug: props.projectSlug,
                              targetSlug: target.target.slug,
                              coordinate: change.path!.join('.'),
                            }}
                            target="_blank"
                          >
                            {target.name}
                          </Link>
                        )}
                        {index === arr.length - 1
                          ? null
                          : index === arr.length - 2
                            ? ' and '
                            : ', '}
                      </>
                    ))}{' '}
                    target insights for live usage data.
                  </span>
                )}
              </div>
            </div>
          ) : change.criticality === CriticalityLevel.Breaking ? (
            <>{change.criticalityReason ?? 'No details available for this breaking change.'}</>
          ) : (
            <>No details available for this change.</>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function ApprovedByBadge(props: {
  approval: FragmentType<typeof ChangesBlock_SchemaChangeApprovalFragment>;
}) {
  const approval = useFragment(ChangesBlock_SchemaChangeApprovalFragment, props.approval);
  const approvalName = approval.approvedBy?.displayName ?? '<unknown>';

  return (
    <span className="cursor-pointer text-green-500">
      <CheckIcon className="inline size-3" /> Approved by {approvalName}
    </span>
  );
}

function SchemaChangeApproval(props: {
  approval: FragmentType<typeof ChangesBlock_SchemaChangeApprovalFragment>;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  schemaCheckId: string;
}) {
  const approval = useFragment(ChangesBlock_SchemaChangeApprovalFragment, props.approval);
  const approvalName = approval.approvedBy?.displayName ?? '<unknown>';
  const approvalDate = format(new Date(approval.approvedAt), 'do MMMM yyyy');
  const schemaCheckPath =
    '/' +
    [
      props.organizationSlug,
      props.projectSlug,
      props.targetSlug,
      'checks',
      approval.schemaCheckId,
    ].join('/');

  return (
    <div className="mb-3">
      This breaking change was manually{' '}
      {approval.schemaCheckId === props.schemaCheckId ? (
        <>
          {' '}
          approved by {approvalName} in this schema check on {approvalDate}.
        </>
      ) : (
        <a href={schemaCheckPath} className="text-orange-500 hover:underline">
          approved by {approvalName} on {approvalDate}.
        </a>
      )}
    </div>
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
