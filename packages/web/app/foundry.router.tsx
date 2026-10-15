import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  type AnyRouter,
} from '@tanstack/react-router';

/**
 * A stand-in router for previews.
 *
 * `Link` throws without router context, and the real router in `src/router.tsx` is unusable here:
 * it pulls in every page, and with them `@/env/frontend`, which validates an environment foundry
 * does not have.
 *
 * `RouterContextProvider` looks like the obvious fit but is not enough. It supplies the router
 * without ever resolving a location, so `state.matches` stays empty and `Link`'s `useMatch` fails
 * with "Could not find a nearest match!". Only `RouterProvider` initialises matches, and it renders
 * the matched route rather than its children.
 *
 * So the root route renders whatever is in `PreviewSlot`, and the provider puts the preview's
 * children there. `RouterProvider` gets its normal lifecycle; the canvas still shows the preview.
 */
const PreviewSlot = createContext<ReactNode>(null);

export const PreviewSlotProvider = PreviewSlot.Provider;

function SlotOutlet() {
  return <>{useContext(PreviewSlot)}</>;
}

const rootRoute = createRootRoute({ component: SlotOutlet });

// `useSlugs` reads the app's route ids, so the slugs nest under layouts with the same ids.
const authenticatedRoute = createRoute({ getParentRoute: () => rootRoute, id: 'authenticated' });
const withHeaderRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: 'with-header',
});
const organizationRoute = createRoute({
  getParentRoute: () => withHeaderRoute,
  path: '$organizationSlug',
});
const projectRoute = createRoute({ getParentRoute: () => organizationRoute, path: '$projectSlug' });
const targetRoute = createRoute({ getParentRoute: () => projectRoute, path: '$targetSlug' });

const routeTree = rootRoute.addChildren([
  authenticatedRoute.addChildren([
    withHeaderRoute.addChildren([
      organizationRoute.addChildren([projectRoute.addChildren([targetRoute])]),
    ]),
  ]),
  createRoute({ getParentRoute: () => rootRoute, path: '$' }),
]);

export const previewRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

/** A stand-in router positioned at `path`, for components whose rendering depends on the URL. */
export function createPreviewRouter(path: string) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
}

/**
 * Renders `children` inside their own stand-in router at `path`, nested in whatever router the
 * preview or spec already has: `Link` reads the nearest one, so a story can show what a nav looks
 * like on a given page. The cast steps around the app's registered router type, which the
 * stand-in does not share.
 */
export function RouterAt(props: { path: string; children: ReactNode }) {
  const router = useMemo(() => createPreviewRouter(props.path), [props.path]);
  return (
    <PreviewSlotProvider value={props.children}>
      <RouterProvider router={router as AnyRouter} />
    </PreviewSlotProvider>
  );
}
