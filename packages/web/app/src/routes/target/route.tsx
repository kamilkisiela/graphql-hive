import { z } from 'zod';
import { TargetLayoutQuery } from '@/components/layouts/queries';
import { TargetLayout } from '@/components/layouts/target';
import { DiffsWorkerPoolProvider } from '@/components/ui/diffs';
import { loadQuery } from '@/lib/route-utils';
import { TargetPage, TargetSchemaPageQuery } from '@/pages/target';
import { createRoute, Outlet } from '@tanstack/react-router';
import { withHeaderRoute } from '../with-header';

export const targetRoute = createRoute({
  getParentRoute: () => withHeaderRoute,
  path: '$organizationSlug/$projectSlug/$targetSlug',
  loader: loader => {
    const { organizationSlug, projectSlug, targetSlug } = loader.params;
    void loadQuery(loader, TargetLayoutQuery, { organizationSlug, projectSlug, targetSlug });
  },
  component: function TargetRoute() {
    return (
      <TargetLayout>
        <Outlet />
      </TargetLayout>
    );
  },
});

export const targetIndexRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: '/',
  validateSearch: z.object({
    service: z.string().optional(),
  }),
  loader: loader => {
    const { organizationSlug, projectSlug, targetSlug } = loader.params;
    void loadQuery(loader, TargetSchemaPageQuery, { organizationSlug, projectSlug, targetSlug });
  },
  component: function TargetIndexRoute() {
    return (
      <DiffsWorkerPoolProvider>
        <TargetPage />
      </DiffsWorkerPoolProvider>
    );
  },
});
