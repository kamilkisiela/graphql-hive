import { z } from 'zod';
import { presetLast7Days } from '@/components/ui/date-range-picker';
import { DiffsWorkerPoolProvider } from '@/components/ui/diffs';
import { loaderPeriod } from '@/lib/hooks/use-date-range-controller';
import {
  defaultRange,
  loadQuery,
  requireRange,
  revalidate,
  type RangeBounds,
} from '@/lib/route-utils';
import { TargetInsightsNewPageContent_TraceQuery, TargetTracePage } from '@/pages/target-trace';
import {
  defaultTracesFilter,
  defaultTracesSort,
  TargetTracesFilterState,
  TargetTracesPage,
  TargetTracesPageQuery,
  TargetTracesSort,
  tracesPageVariables,
} from '@/pages/target-traces';
import { createRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { targetRoute } from './route';

const TargetTracesRouteSearch = z.object({
  filter: TargetTracesFilterState.optional(),
  sort: TargetTracesSort.shape.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const traces: RangeBounds = {
  preset: presetLast7Days,
  to: '/$organizationSlug/$projectSlug/$targetSlug/traces',
};

export const targetTracesRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'traces',
  validateSearch: zodValidator(TargetTracesRouteSearch),
  beforeLoad: defaultRange(traces),
  loaderDeps: ({ search }) => ({
    filter: search.filter ?? defaultTracesFilter,
    sort: search.sort ?? defaultTracesSort,
    from: search.from,
    to: search.to,
  }),
  preloadStaleTime: 0,
  loader: loader => {
    requireRange(loader, traces);
    const { organizationSlug, projectSlug, targetSlug } = loader.params;
    const { period } = loaderPeriod(loader.deps, presetLast7Days);
    void loadQuery(
      loader,
      TargetTracesPageQuery,
      tracesPageVariables(
        { organizationSlug, projectSlug, targetSlug },
        loader.deps.filter,
        loader.deps.sort,
        period,
      ),
      revalidate(loader),
    );
    return { period };
  },
  component: function TargetTracesRoute() {
    const { filter = defaultTracesFilter, sort = defaultTracesSort } =
      targetTracesRoute.useSearch();
    return <TargetTracesPage sorting={sort} filter={filter} />;
  },
});

// The list's range rides along, so the breadcrumb back lands on the same range.
const TargetTraceRouteSearchModel = z.object({
  activeSpanId: z.string().optional(),
  activeSpanTab: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const targetTraceRoute = createRoute({
  getParentRoute: () => targetRoute,
  validateSearch(search) {
    return TargetTraceRouteSearchModel.parse(search);
  },
  path: 'traces/$traceId',
  loader: loader => {
    const { organizationSlug, projectSlug, targetSlug, traceId } = loader.params;
    void loadQuery(loader, TargetInsightsNewPageContent_TraceQuery, {
      targetSelector: { organizationSlug, projectSlug, targetSlug },
      traceId,
    });
  },
  component: function TargetTraceRoute() {
    const { traceId } = targetTraceRoute.useParams();
    const { activeSpanId, activeSpanTab } = targetTraceRoute.useSearch();
    return (
      <DiffsWorkerPoolProvider>
        <TargetTracePage
          traceId={traceId}
          activeSpanId={activeSpanId ?? null}
          activeSpanTab={activeSpanTab ?? null}
        />
      </DiffsWorkerPoolProvider>
    );
  },
});
