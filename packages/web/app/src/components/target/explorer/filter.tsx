import { ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from 'urql';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Autocomplete } from '@/components/v2';
import { graphql } from '@/gql';
import { useArgumentListToggle, usePeriodSelector } from './provider';

const TypeFilter_AllTypes = graphql(`
  query TypeFilter_AllTypes(
    $organization: ID!
    $project: ID!
    $target: ID!
    $period: DateRangeInput!
  ) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      __typename
      id
      latestSchemaVersion {
        __typename
        id
        valid
        explorer(usage: { period: $period }) {
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
          }
        }
      }
    }
  }
`);

export function TypeFilter(props: {
  typename?: string;
  organizationId: string;
  projectId: string;
  targetId: string;
  period: {
    to: string;
    from: string;
  };
}) {
  const router = useRouter();
  const [query] = useQuery({
    query: TypeFilter_AllTypes,
    variables: {
      organization: props.organizationId,
      project: props.projectId,
      target: props.targetId,
      period: props.period,
    },
    requestPolicy: 'cache-first',
  });

  const allNamedTypes = query.data?.target?.latestSchemaVersion?.explorer?.types;
  const types = useMemo(
    () =>
      allNamedTypes?.map(t => ({
        value: t.name,
        label: t.name,
      })) || [],
    [allNamedTypes],
  );

  return (
    <Autocomplete
      className="min-w-[200px] grow cursor-text"
      placeholder="Search for a type"
      defaultValue={props.typename ? { value: props.typename, label: props.typename } : null}
      options={types}
      onChange={option => {
        void router.push(
          `/${props.organizationId}/${props.projectId}/${props.targetId}/explorer/${option.value}`,
        );
      }}
      loading={query.fetching}
    />
  );
}

export function FieldByNameFilter() {
  const router = useRouter();

  return (
    <Input
      className="w-[200px] grow cursor-text"
      placeholder="Filter by field name"
      onChange={e => {
        if (e.target.value === '') {
          const routerQuery = router.query;
          delete routerQuery.search;
          void router.push({ query: routerQuery }, undefined, { shallow: true });
          return;
        }

        void router.push(
          {
            query: {
              ...router.query,
              search: e.target.value === '' ? undefined : e.target.value,
            },
          },
          undefined,
          { shallow: true },
        );
      }}
      value={typeof router.query.search === 'string' ? router.query.search : ''}
    />
  );
}

export function DateRangeFilter() {
  const periodSelector = usePeriodSelector();

  return (
    <DateRangePicker
      validUnits={['y', 'M', 'w', 'd', 'h']}
      onUpdate={value => {
        periodSelector.setPeriod(value.preset.range);
      }}
      selectedRange={periodSelector.period}
      startDate={periodSelector.startDate}
      align="end"
    />
  );
}

export function ArgumentVisibilityFilter() {
  const [collapsed, toggleCollapsed] = useArgumentListToggle();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="bg-secondary flex h-[40px] flex-row items-center gap-x-4 rounded-md border px-3">
            <div>
              <Label htmlFor="filter-toggle-arguments" className="text-sm font-normal">
                All arguments
              </Label>
            </div>
            <Switch
              checked={!collapsed}
              onCheckedChange={toggleCollapsed}
              id="filter-toggle-arguments"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          List of arguments is collapsed by default. You can toggle this setting to display all
          arguments.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SchemaVariantFilter(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
  variant: 'all' | 'unused' | 'deprecated';
}) {
  const router = useRouter();

  return (
    <TooltipProvider>
      <Tabs defaultValue={props.variant}>
        <TabsList>
          <Tooltip>
            <TooltipTrigger>
              {props.variant === 'all' ? (
                <TabsTrigger value="all">All</TabsTrigger>
              ) : (
                <TabsTrigger value="all" asChild>
                  <Link
                    href={{
                      pathname: '/[organizationId]/[projectId]/[targetId]/explorer',
                      query: {
                        organizationId: props.organizationId,
                        projectId: props.projectId,
                        targetId: props.targetId,
                      },
                    }}
                  >
                    All
                  </Link>
                </TabsTrigger>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Shows all types, including unused and deprecated ones.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              {props.variant === 'unused' ? (
                <TabsTrigger value="unused">Unused</TabsTrigger>
              ) : (
                <TabsTrigger value="unused">
                  <Link
                    href={{
                      pathname: '/[organizationId]/[projectId]/[targetId]/explorer/unused',
                      query: {
                        organizationId: props.organizationId,
                        projectId: props.projectId,
                        targetId: props.targetId,
                      },
                    }}
                  >
                    Unused
                  </Link>
                </TabsTrigger>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Shows only types that are not used in any operation.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              {props.variant === 'deprecated' ? (
                <TabsTrigger value="deprecated">Deprecated</TabsTrigger>
              ) : (
                <TabsTrigger value="deprecated">
                  <Link
                    href={{
                      pathname: '/[organizationId]/[projectId]/[targetId]/explorer/deprecated',
                      query: {
                        organizationId: props.organizationId,
                        projectId: props.projectId,
                        targetId: props.targetId,
                      },
                    }}
                  >
                    Deprecated
                  </Link>
                </TabsTrigger>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Shows only types that are marked as deprecated.
            </TooltipContent>
          </Tooltip>
        </TabsList>
      </Tabs>
    </TooltipProvider>
  );
}
