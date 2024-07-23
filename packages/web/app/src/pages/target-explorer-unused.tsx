import { memo, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns/format';
import { startOfMinute } from 'date-fns/startOfMinute';
import { subYears } from 'date-fns/subYears';
import { AlertCircleIcon, CalendarIcon, PartyPopperIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { z } from 'zod';
import { Page, TargetLayout } from '@/components/layouts/target';
import { SchemaVariantFilter } from '@/components/target/explorer/filter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { EmptyList, noSchemaVersion } from '@/components/ui/empty-list';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Link } from '@/components/ui/link';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QueryError } from '@/components/ui/query-error';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FragmentType, graphql, useFragment } from '@/gql';
import { subDays } from '@/lib/date-time';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import { TypeRenderer, TypeRenderFragment } from './target-explorer-type';

const ageFilterFormSchema = z.object({
  date: z.date().nullable(),
  age: z.coerce.number().min(1).max(365).nullable(),
});

type AgeFilterFormValues = z.infer<typeof ageFilterFormSchema>;

function AgeFilter(props: { createdBefore: string | null; olderThan: number | null }) {
  const title = 'Min age';
  const tooltip = (
    <div>
      <p className="font-semibold">Filter schema by age.</p>
      <p>Select 14 days to view fields that have been present for at least 14 days.</p>
    </div>
  );

  const router = useRouter();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const form = useForm<AgeFilterFormValues>({
    resolver: zodResolver(ageFilterFormSchema),
    mode: 'onChange',
    defaultValues: {
      date: props.createdBefore ? new Date(props.createdBefore) : null,
      age: props.olderThan ?? null,
    },
  });

  const ageFilter = props.createdBefore
    ? format(props.createdBefore, 'PPP')
    : props.olderThan
      ? `${props.olderThan} days`
      : null;

  function resetOtherOnChange(fieldName: keyof AgeFilterFormValues) {
    form.setValue(fieldName, null);
  }

  function onReset() {
    form.reset();
    void router.navigate({
      search(params) {
        return {
          ...params,
          created_before: undefined,
          older_than: undefined,
        };
      },
    });
    setFilterOpen(false);
  }

  function onSubmit(values: AgeFilterFormValues) {
    const date = values.date;
    const age = values.age;

    if (date) {
      void router.navigate({
        search(params) {
          return {
            ...params,
            created_before: format(date, 'yyyy-MM-dd'),
            older_than: undefined,
          };
        },
      });
    } else if (age) {
      void router.navigate({
        search(params) {
          return {
            ...params,
            older_than: age,
            created_before: undefined,
          };
        },
      });
    } else {
      void router.navigate({
        search(params) {
          return {
            ...params,
            created_before: undefined,
            older_than: undefined,
          };
        },
      });
    }

    // TODO: fix a bug when the filter is closed, but the tooltip shows up
    setFilterOpen(false);
  }

  return (
    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
      <TooltipProvider>
        <Tooltip open={!tooltip || filterOpen ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild onClick={() => setFilterOpen(isOpen => !isOpen)}>
              <Button variant="outline">
                {title}
                {ageFilter ? (
                  <>
                    <Separator orientation="vertical" className="mx-2 h-4" />
                    <Badge variant="gray" className="rounded-sm px-1 font-normal">
                      {/* <span className="text-muted-foreground"> */}
                      {ageFilter}
                      {/* </span> */}
                    </Badge>
                  </>
                ) : null}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent hideWhenDetached>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="grid w-auto gap-y-4 p-3" align="end">
        <div>
          <div className="font-semibold">Filter schema by age</div>
          <div className="text-sm text-gray-400">Find old and unused fields.</div>
        </div>
        <div className="mt-2">
          <Form {...form}>
            <form className="grid gap-y-2" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Older than</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter number of days"
                        type="number"
                        min={1}
                        max={365}
                        {...field}
                        value={field.value ?? ''}
                        onChange={ev => {
                          resetOtherOnChange('date');
                          field.onChange(ev);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex flex-row items-center justify-between gap-x-4">
                <div className="bg-border h-[1px] w-full" />
                <div className="text-center text-gray-400">or</div>
                <div className="bg-border h-[1px] w-full" />
              </div>
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Created before</FormLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger
                        asChild
                        onClick={() => {
                          setCalendarOpen(prev => !prev);
                        }}
                      >
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-[240px] pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto size-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={date => {
                            resetOtherOnChange('age');
                            field.onChange(date);
                            setCalendarOpen(false);
                          }}
                          disabled={date => date > new Date() || date <= subYears(new Date(), 1)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />
              <div className="mt-4 space-y-2">
                <Button type="submit" className="w-full">
                  Apply filter
                </Button>
                <Button
                  variant="outline"
                  onClick={e => {
                    e.preventDefault();
                    onReset();
                  }}
                  className="w-full"
                >
                  Reset
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const UnusedSchemaView_UnusedSchemaExplorerFragment = graphql(`
  fragment UnusedSchemaView_UnusedSchemaExplorerFragment on UnusedSchemaExplorer {
    types {
      __typename
      ... on GraphQLObjectType {
        name
      }
      ... on GraphQLInterfaceType {
        name
      }
      ... on GraphQLUnionType {
        name
      }
      ... on GraphQLEnumType {
        name
      }
      ... on GraphQLInputObjectType {
        name
      }
      ... on GraphQLScalarType {
        name
      }
      ...TypeRenderFragment
    }
  }
`);

const UnusedSchemaView = memo(function _UnusedSchemaView(props: {
  explorer: FragmentType<typeof UnusedSchemaView_UnusedSchemaExplorerFragment>;
  totalRequests: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
  letter: string | null;
}) {
  const { types } = useFragment(UnusedSchemaView_UnusedSchemaExplorerFragment, props.explorer);

  const typesGroupedByFirstLetter = useMemo(() => {
    const grouped = new Map<string, FragmentType<typeof TypeRenderFragment>[]>([]);

    for (const type of types) {
      const letter = type.name[0].toLocaleUpperCase();
      const existingNameGroup = grouped.get(letter);

      if (existingNameGroup) {
        existingNameGroup.push(type);
      } else {
        grouped.set(letter, [type]);
      }
    }
    return grouped;
  }, [types]);

  const router = useRouter();

  const letters = Array.from(typesGroupedByFirstLetter.keys()).sort();
  const selectedLetter = props.letter ?? letters[0];

  useEffect(() => {
    if (!props.letter && letters.length > 0) {
      void router.navigate({
        search(params) {
          return {
            ...params,
            letter: letters[0],
          };
        },
      });
    }
  }, [props.letter]);

  if (types.length === 0) {
    return (
      <div className="flex h-[250px] shrink-0 items-center justify-center rounded-md border border-dashed">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <PartyPopperIcon className="size-10 text-emerald-500" />

          <h3 className="mt-4 text-lg font-semibold">No unused types</h3>
          <p className="text-muted-foreground mb-4 mt-2 text-sm">
            It looks like you are using all types in your schema, congratulations!
          </p>
        </div>
      </div>
    );
  }

  if (!selectedLetter) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-x-4">
        <span className="text-gray-500">Filter by first letter:</span>
        <span>
          <TooltipProvider>
            {letters.map(letter => {
              const count = typesGroupedByFirstLetter.get(letter)?.length ?? 0;

              return (
                <Tooltip key={letter} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() =>
                        router.navigate({
                          search(params) {
                            return {
                              ...params,
                              letter,
                            };
                          },
                        })
                      }
                      variant={letter === selectedLetter ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'rounded-none px-2 py-1',
                        letter === selectedLetter
                          ? 'text-orange-500'
                          : 'text-gray-500 hover:text-orange-500',
                      )}
                      key={letter}
                    >
                      {letter}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {count === 0 ? 'No types' : count > 1 ? `${count} types` : `${count} type`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {(typesGroupedByFirstLetter.get(selectedLetter) ?? []).map((type, i) => {
          return (
            <TypeRenderer
              key={i}
              type={type}
              organizationCleanId={props.organizationCleanId}
              projectCleanId={props.projectCleanId}
              targetCleanId={props.targetCleanId}
              warnAboutDeprecatedArguments={false}
              warnAboutUnusedArguments
              styleDeprecated
            />
          );
        })}
      </div>
    </div>
  );
});

const UnusedSchemaExplorer_UnusedSchemaQuery = graphql(`
  query UnusedSchemaExplorer_UnusedSchemaQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $period: DateRangeInput!
    $schemaFilter: UnusedSchemaExplorerSchemaFilterInput
  ) {
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      cleanId
      latestSchemaVersion {
        id
      }
      latestValidSchemaVersion {
        __typename
        id
        valid
        unusedSchema(filter: { usage: $period, schema: $schemaFilter }) {
          ...UnusedSchemaView_UnusedSchemaExplorerFragment
        }
      }
    }
    operationsStats(
      selector: {
        organization: $organizationId
        project: $projectId
        target: $targetId
        period: $period
      }
    ) {
      totalRequests
    }
  }
`);

function UnusedSchemaExplorer(props: {
  dataRetentionInDays: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
  letter: string | null;
  createdBefore: string | null;
  olderThan: number | null;
}) {
  const dateRangeController = useDateRangeController({
    dataRetentionInDays: props.dataRetentionInDays,
    defaultPreset: presetLast7Days,
  });

  const [query, refresh] = useQuery({
    query: UnusedSchemaExplorer_UnusedSchemaQuery,
    variables: {
      organizationId: props.organizationCleanId,
      projectId: props.projectCleanId,
      targetId: props.targetCleanId,
      period: dateRangeController.resolvedRange,
      schemaFilter:
        props.createdBefore || props.olderThan
          ? {
              createdBeforeDate: props.createdBefore
                ? new Date(props.createdBefore).toISOString()
                : props.olderThan
                  ? subDays(startOfMinute(new Date()), props.olderThan).toISOString()
                  : undefined,
            }
          : undefined,
    },
  });

  useEffect(() => {
    if (!query.fetching) {
      refresh({ requestPolicy: 'network-only' });
    }
  }, [dateRangeController.resolvedRange]);

  if (query.error) {
    return <QueryError organizationId={props.organizationCleanId} error={query.error} />;
  }

  const latestSchemaVersion = query.data?.target?.latestSchemaVersion;
  const latestValidSchemaVersion = query.data?.target?.latestValidSchemaVersion;

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Unused Schema</Title>
          <Subtitle>
            Helps you understand the coverage of GraphQL schema and safely remove the unused part
          </Subtitle>
        </div>
        <div className="flex justify-end gap-x-2">
          <AgeFilter createdBefore={props.createdBefore} olderThan={props.olderThan} />
          <DateRangePicker
            label="Usage"
            tooltip={
              <>
                <p className="font-semibold">Filter schema pieces by their usage.</p>
                <p>Select 7 days to see fields that haven't been requested in the past 7 days.</p>
              </>
            }
            validUnits={['y', 'M', 'w', 'd', 'h']}
            selectedRange={dateRangeController.selectedPreset.range}
            startDate={dateRangeController.startDate}
            align="end"
            onUpdate={args => dateRangeController.setSelectedPreset(args.preset)}
          />
          <SchemaVariantFilter
            organizationId={props.organizationCleanId}
            projectId={props.projectCleanId}
            targetId={props.targetCleanId}
            variant="unused"
          />
        </div>
      </div>
      {!query.fetching && (
        <>
          {latestValidSchemaVersion?.unusedSchema && latestSchemaVersion ? (
            <>
              {latestSchemaVersion.id !== latestValidSchemaVersion.id && (
                <Alert className="mb-3">
                  <AlertCircleIcon className="size-4" />
                  <AlertTitle>Outdated Schema</AlertTitle>
                  <AlertDescription className="max-w-[600px]">
                    The latest schema version is <span className="font-bold">not valid</span> , thus
                    the explorer might not be accurate as it is showing the{' '}
                    <span className="font-bold">latest valid</span> schema version. We recommend you
                    to publish a new schema version that is composable before using this explorer
                    for decision making.
                    <br />
                    <br />
                    <Link
                      to="/$organizationId/$projectId/$targetId/history/$versionId"
                      params={{
                        organizationId: props.organizationCleanId,
                        projectId: props.projectCleanId,
                        targetId: props.targetCleanId,
                        versionId: latestSchemaVersion.id,
                      }}
                    >
                      <span className="font-bold"> See the invalid schema version</span>
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
              <UnusedSchemaView
                totalRequests={query.data?.operationsStats.totalRequests ?? 0}
                explorer={latestValidSchemaVersion.unusedSchema}
                organizationCleanId={props.organizationCleanId}
                projectCleanId={props.projectCleanId}
                targetCleanId={props.targetCleanId}
                letter={props.letter}
              />
            </>
          ) : (
            noSchemaVersion
          )}
        </>
      )}
    </>
  );
}

const TargetExplorerUnusedSchemaPageQuery = graphql(`
  query TargetExplorerUnusedSchemaPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        id
        rateLimit {
          retentionInDays
        }
        cleanId
      }
    }
    hasCollectedOperations(
      selector: { organization: $organizationId, project: $projectId, target: $targetId }
    )
  }
`);

function ExplorerUnusedSchemaPageContent(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  letter: string | null;
  createdBefore: string | null;
  olderThan: number | null;
}) {
  const [query] = useQuery({
    query: TargetExplorerUnusedSchemaPageQuery,
    variables: {
      organizationId: props.organizationId,
      projectId: props.projectId,
      targetId: props.targetId,
    },
  });

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  const currentOrganization = query.data?.organization?.organization;
  const hasCollectedOperations = query.data?.hasCollectedOperations === true;

  return (
    <TargetLayout
      organizationId={props.organizationId}
      projectId={props.projectId}
      targetId={props.targetId}
      page={Page.Explorer}
    >
      {currentOrganization ? (
        hasCollectedOperations ? (
          <UnusedSchemaExplorer
            dataRetentionInDays={currentOrganization.rateLimit.retentionInDays}
            organizationCleanId={props.organizationId}
            projectCleanId={props.projectId}
            targetCleanId={props.targetId}
            letter={props.letter}
            createdBefore={props.createdBefore}
            olderThan={props.olderThan}
          />
        ) : (
          <div className="py-8">
            <EmptyList
              title="Hive is waiting for your first collected operation"
              description="You can collect usage of your GraphQL API with Hive Client"
              docsUrl="/features/usage-reporting"
            />
          </div>
        )
      ) : null}
    </TargetLayout>
  );
}

export function TargetExplorerUnusedPage(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  letter: string | null;
  createdBefore: string | null;
  olderThan: number | null;
}) {
  return (
    <>
      <Meta title="Unused Schema Explorer" />
      <ExplorerUnusedSchemaPageContent {...props} />
    </>
  );
}
