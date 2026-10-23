import { OperationsList_OperationsStatsQuery } from '@/components/target/insights/list';
import {
  InsightsDateRangeSearch,
  InsightsFilterSearch,
} from '@/components/target/insights/search-schemas';
import { Stats_GeneralOperationsStatsQuery } from '@/components/target/insights/stats';
import { presetLast1Day, presetLast7Days, type Preset } from '@/components/ui/date-range-picker';
import { DiffsWorkerPoolProvider } from '@/components/ui/diffs';
import { loaderPeriod } from '@/lib/hooks/use-date-range-controller';
import {
  defaultRange,
  loadQuery,
  requireRange,
  requireRetention,
  revalidate,
  type RangeBounds,
} from '@/lib/route-utils';
import {
  buildGraphQLFilter,
  InsightsFilterPicker_Query,
  TargetInsightsPage,
  TargetOperationsPageQuery,
} from '@/pages/target-insights';
import {
  ClientInsightsPageQuery,
  ClientView_ClientStatsQuery,
  TargetInsightsClientPage,
} from '@/pages/target-insights-client';
import {
  coordinateType,
  SchemaCoordinateView_SchemaCoordinateStatsQuery,
  TargetInsightsCoordinatePage,
  TargetSchemaCoordinatePageQuery,
} from '@/pages/target-insights-coordinate';
import {
  ManageFilters_SavedFiltersQuery,
  TargetInsightsManageFiltersPage,
} from '@/pages/target-insights-manage-filters';
import {
  Operation_View_OperationBodyQuery,
  OperationInsightsPageQuery,
  TargetInsightsOperationPage,
} from '@/pages/target-insights-operation';
import { createRoute } from '@tanstack/react-router';
import { targetRoute } from './route';

const insights = (preset: Preset, to: string): RangeBounds => ({ preset, to });
const operationsBounds = insights(
  presetLast7Days,
  '/$organizationSlug/$projectSlug/$targetSlug/insights',
);
const coordinateBounds = insights(
  presetLast7Days,
  '/$organizationSlug/$projectSlug/$targetSlug/insights/schema-coordinate/$coordinate',
);
const clientBounds = insights(
  presetLast7Days,
  '/$organizationSlug/$projectSlug/$targetSlug/insights/client/$name',
);
const operationBounds = insights(
  presetLast1Day,
  '/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash',
);

export const targetInsightsRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights',
  validateSearch: InsightsFilterSearch.parse,
  beforeLoad: defaultRange(operationsBounds),
  // Everything in the search but the saved filter's id reaches a query.
  loaderDeps: ({ search: { viewId: _viewId, ...deps } }) => deps,
  // A preload only warms, so the visit that follows it still runs the loader.
  preloadStaleTime: 0,
  loader: async loader => {
    requireRange(loader, operationsBounds);
    const { organizationSlug, projectSlug, targetSlug } = loader.params;
    const selector = { organizationSlug, projectSlug, targetSlug };
    const { period, resolution } = loaderPeriod(loader.deps, presetLast7Days);
    const filter = buildGraphQLFilter(loader.deps);
    void loadQuery(loader, TargetOperationsPageQuery, selector);
    void loadQuery(loader, InsightsFilterPicker_Query, { selector, period });
    void loadQuery(
      loader,
      Stats_GeneralOperationsStatsQuery,
      { targetSelector: selector, period, filter, resolution },
      revalidate(loader),
    );
    void loadQuery(
      loader,
      OperationsList_OperationsStatsQuery,
      { targetSelector: selector, period, filter },
      revalidate(loader),
    );
    // The page reads the period from here, so both sides resolve "now" once.
    await requireRetention(loader, operationsBounds);
    return { period, resolution };
  },
  component: TargetInsightsPage,
});

export const targetInsightsManageFiltersRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/manage-filters',
  loader: loader => {
    const { organizationSlug, projectSlug, targetSlug } = loader.params;
    void loadQuery(loader, ManageFilters_SavedFiltersQuery, {
      organizationSlug,
      selector: { organizationSlug, projectSlug, targetSlug },
    });
  },
  component: TargetInsightsManageFiltersPage,
});

// Client and coordinate default to the last week without a redirect, like the operation route.
const lastWeek = ({ search }: { search: { from?: string; to?: string } }) => ({
  from: search.from ?? presetLast7Days.range.from,
  to: search.to ?? presetLast7Days.range.to,
});

export const targetInsightsCoordinateRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/schema-coordinate/$coordinate',
  validateSearch: InsightsDateRangeSearch.parse,
  loaderDeps: lastWeek,
  preloadStaleTime: 0,
  loader: async loader => {
    requireRange(loader, coordinateBounds);
    const { organizationSlug, projectSlug, targetSlug, coordinate } = loader.params;
    const selector = { organizationSlug, projectSlug, targetSlug };
    const { period, resolution } = loaderPeriod(loader.deps, presetLast7Days);
    void loadQuery(loader, TargetSchemaCoordinatePageQuery, selector);
    void loadQuery(
      loader,
      SchemaCoordinateView_SchemaCoordinateStatsQuery,
      {
        targetSelector: selector,
        type: coordinateType(coordinate),
        schemaCoordinate: coordinate,
        period,
        resolution,
      },
      revalidate(loader),
    );
    await requireRetention(loader, coordinateBounds);
    return { period, resolution };
  },
  component: function TargetInsightsRoute() {
    const { coordinate } = targetInsightsCoordinateRoute.useParams();
    return <TargetInsightsCoordinatePage coordinate={coordinate} />;
  },
});

export const targetInsightsClientRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/client/$name',
  validateSearch: InsightsDateRangeSearch.parse,
  loaderDeps: lastWeek,
  preloadStaleTime: 0,
  loader: async loader => {
    requireRange(loader, clientBounds);
    const { organizationSlug, projectSlug, targetSlug, name } = loader.params;
    const selector = { organizationSlug, projectSlug, targetSlug };
    const { period, resolution } = loaderPeriod(loader.deps, presetLast7Days);
    void loadQuery(loader, ClientInsightsPageQuery, selector);
    void loadQuery(
      loader,
      ClientView_ClientStatsQuery,
      { targetSelector: selector, period, clientName: name, resolution },
      revalidate(loader),
    );
    await requireRetention(loader, clientBounds);
    return { period, resolution };
  },
  component: function TargetInsightsRoute() {
    const { name } = targetInsightsClientRoute.useParams();
    return <TargetInsightsClientPage name={name} />;
  },
});

export const targetInsightsOperationsRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/$operationName/$operationHash',
  validateSearch: InsightsDateRangeSearch.parse,
  loaderDeps: ({ search }) => ({
    from: search.from ?? presetLast1Day.range.from,
    to: search.to ?? presetLast1Day.range.to,
  }),
  preloadStaleTime: 0,
  loader: async loader => {
    requireRange(loader, operationBounds);
    const { organizationSlug, projectSlug, targetSlug, operationHash } = loader.params;
    const selector = { organizationSlug, projectSlug, targetSlug };
    const { period, resolution } = loaderPeriod(loader.deps, presetLast1Day);
    void loadQuery(loader, OperationInsightsPageQuery, selector);
    void loadQuery(loader, Operation_View_OperationBodyQuery, { selector, hash: operationHash });
    void loadQuery(
      loader,
      Stats_GeneralOperationsStatsQuery,
      { targetSelector: selector, period, filter: { operationIds: [operationHash] }, resolution },
      revalidate(loader),
    );
    await requireRetention(loader, operationBounds);
    return { period, resolution };
  },
  component: function TargetInsightsRoute() {
    const { operationName, operationHash } = targetInsightsOperationsRoute.useParams();
    return (
      <DiffsWorkerPoolProvider>
        <TargetInsightsOperationPage operationName={operationName} operationHash={operationHash} />
      </DiffsWorkerPoolProvider>
    );
  },
});
