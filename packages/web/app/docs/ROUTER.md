# Routing in `@hive/app`

How pages, layouts, navigation and redirects fit together, and the recipe for adding to them. The
router is [TanStack Router](https://tanstack.com/router) in code-based mode: routes are
`createRoute(...)` objects in `src/routes/`, assembled into one tree in `src/routes/tree.ts`.

## Two patterns and one rule

**1. A route owns its layout and renders `<Outlet/>` inside it.** The pathless `with-header` route
renders the header (selector, user menu) once above the organization, project and target routes;
each of those renders its secondary nav around the outlet; their pages render inside it and know
nothing about the chrome. The same shape repeats one level down: a settings route renders the
sections nav around an outlet, and each section is a child route. Chrome mounts once and stays
mounted while you move between siblings; a page is just its content, wrapped in `<LayoutContent>`.

**2. A nav is a list of `Link`s; the router decides which one is current.** `Navigation`
(`src/components/ui/navigation/navigation.tsx`) takes items
`{ label, to, params, search?, exact?, visible?, attrs? }` (the label is also the key, so unique
within one nav) and marks the current one from the URL through the router's own active-link rules.
There is no `page` prop, no `value`, no route metadata and no pathname parsing. The item whose `to`
is the parent path itself (Schema at the target root, General at `/settings`) carries `exact: true`,
because a plain link is current on a path prefix.

**The rule that makes 2 work: the default section has no marker in the URL.** `/settings` is
General, `/view/members` is the list, `/alerts` is Activity. Every other section is a path under its
parent: `/settings/cdn`, `/view/members/roles`, `/alerts/rules`. A page's detail lives under the
page's path (`/traces/$traceId`, `/history/$versionId`, `/checks/$schemaCheckId`) so the section's
item stays current on it.

**3. Redirects run in the router and throw `redirect()`.** The router follows them before rendering
and commits with `replace`, so the old URL never enters history. Every redirect that exists because
a URL moved is an entry in `src/routes/legacy.ts` (see below). Redirects that depend on config or on
the URL alone live in `beforeLoad` (`/auth` → sign-in, `/oidc-request` when the provider is off, a
bare `/insights` → its default range); one that depends on query data awaits the document in the
route's loader (`/history` → latest version, a viewer landing on a settings or members section they
may not open, a permission gate on a layout flag; see [DATA.md](./DATA.md)). No page under a layout
redirects from a render effect any more; only the root index (`src/pages/index.tsx`) still does.

## Where things live

```
src/main.tsx                 creates the router with the real urql client and mounts it
src/router.ts                createAppRouter({ urqlClient, history? }): the tree, the client in router context,
                             search serialization and the default boundaries
src/routes/
  tree.ts                    root.addChildren([...]) mirroring every route's getParentRoute
  root.tsx                   root route, 404, logout, join
  anonymous.tsx              /auth/* (pathless `anonymous` parent)
  authenticated.tsx          /, /dev, /manage, /org/new, transfer (pathless `authenticated` parent: the session gate)
  with-header.tsx            the header, once, above the routes below (pathless `with-header` parent)
  oidc-request.tsx           $organizationSlug/oidc-request, the OIDC interstitial
  organization/route.tsx     $organizationSlug layout + index, support, subscription
  organization/settings.ts   view/settings and its sections
  organization/members.ts    view/members and its sections
  project/route.tsx          $projectSlug layout + index, alerts
  project/settings.ts        view/settings and its sections
  target/route.tsx           $targetSlug layout + index (schema)
  target/settings.ts         settings and its sections
  target/<area>.tsx          one module per secondary tab: checks, explorer, insights, ...
  legacy.ts                  the redirect catalog
  *.spec.ts(x)               the route-level tests (see Testing)
src/pages/*.tsx              page components: content out, wrapped in <LayoutContent>, slugs from useSlugs
src/components/layouts/      the three layouts (org/project/target), LayoutContent, ScopeSelector,
                             and queries.ts: the viewer and layout documents
src/lib/hooks/               useSlugs, useViewer, useLayoutQuery
src/lib/route-utils.ts       loadQuery for route loaders, redirectToPathSchema
src/lib/urql-cache.ts        the graphcache config (keys, pagination resolvers, updaters), shared with the test client
src/lib/testing/             renderAtUrl, the fixture-checking test urql client, fixtures, jsdom mocks
```

Route modules import pages, components and their parent route module, never `src/router.ts`. Pages
and components never import a layout; the route renders it. Both are enforced by
`@typescript-eslint/no-restricted-imports` in the root `.eslintrc.cjs`.

## Reading route state

**Where you are comes from the URL, not from props.**
`useSlugs('organization' | 'project' | 'target')` (`src/lib/hooks/use-slugs.ts`) returns the slugs
of the page you are on, typed exactly for the scope you ask for, so a target page gets three
`string`s rather than three guards. A component below that route calls it instead of taking the
slugs from its parent, and the route stops passing them: most route components are now just
`component: SomePage`.

```tsx
const { organizationSlug, projectSlug, targetSlug } = useSlugs('target')
```

Three kinds of slug stay props, and each has a reason:

- **The slug names something other than the current page.** The target a role is scoped to, the
  project a table row links to: that is data. `members/resource-selector.tsx` is the example.
- **The component renders outside that route.** `QueryError` renders on `/manage` and
  `/join/$inviteCode` too. Asking for a scope you do not sit under errors into the route's error
  boundary rather than returning a blank slug, so the page shows the error screen
  (`use-slugs.spec.tsx` pins this).
- **It is not a component.** `laboratory/plugins/target-env.tsx` is a factory the page calls, so the
  page reads the slugs and hands them over.

A spec that renders one of these components on its own has no router, so it mocks the hook rather
than mounting one:

```tsx
vi.mock('@/lib/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/hooks')>()),
  useSlugs: () => selector
}))
```

For the rest of the route state:

- Inside a route module, use the route object's own hooks: `targetChecksRoute.useParams()`,
  `targetChecksRoute.useSearch()`, `targetChecksRoute.useNavigate()`.
- Anywhere else (pages, components), use `getRouteApi('<route id>')` and the same hooks on it. Never
  `useSearch({ from })` with a bare string or an un-anchored `useNavigate()`; those type against the
  root and lose the route's search schema.
- Route ids are the path from the root with pathless parents as segments and a trailing `/` for
  index routes: `/authenticated/with-header/$organizationSlug/view/members/` is the members list,
  `/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/with-nav/` is
  Activity. `tree.spec.ts` snapshots every id.
- `to` paths are typed against the registered router: a typo in a `Link`, `navigate` or `redirect`
  is a compile error. Prefer that over building paths from strings.
- A link that leaves the app takes `href` and no `to`. `components/ui/link.tsx` renders those as a
  plain anchor, because the router's `Link` re-resolves a bare `href` as an internal location and
  drops the origin.

## Data in the chrome

- The urql client rides in router context: `createAppRouter({ urqlClient })` puts it there, the root
  component provides it to React, and a loader reads it as `context.urqlClient`. Only `src/main.tsx`
  imports the real client from `@/lib/urql`; `router.spec.ts` fails if a route module does.
- `authenticated.tsx` checks the session in `beforeLoad` (`requireSession`), so a loader never runs
  for an anonymous visitor. A session that expires mid-visit is handled by the urql `authExchange`:
  `NEEDS_REFRESH` refreshes and re-sends, `UNAUTHENTICATED` signs out and goes to `/auth`.
- The viewer and layout documents, `useLayoutQuery`, `loadQuery`, request policies, pagination,
  preloading and the loading vocabulary are in [DATA.md](./DATA.md).

## Search params

- Declare them with `validateSearch` on the route that owns them; a section's params go on the
  section route, not the parent (`cdn`/`id` live on `/settings/cdn`).
- Use `zodValidator(z.object({...}))` from `@tanstack/zod-adapter` for new schemas; `.parse` works
  but types the input as the output.
- Navigating writes the validated search back to the URL. A `.default(x)` therefore pins `?x=` onto
  every URL after the first navigation; use `.optional()` and default in the component.
- A param that must never fail validation (a legacy `?page=`) takes `.optional().catch(undefined)`,
  because a validation failure renders the error boundary before `beforeLoad` can redirect.
- `/insights`, `/traces` and `/proposals` serialize search with jsurl2 (arrays and objects); every
  other route uses JSON. See `src/router.ts`.
- A redirect target read from the URL (`redirectToPath`) goes through `redirectToPathSchema` in
  `src/lib/route-utils.ts`, so it is a path on this app or `/` by the time anything follows it.
- A date range (`from`, `to`) is URL state and nothing else: a link into a period page carries the
  current one with `carriedRange(search)`, a bare URL takes the page's default, and a range the
  loader cannot read or the retention does not cover resets to that default with a toast. See
  DATA.md.

## Recipes

### Add a page under a target (a new secondary tab)

1. Write the page in `src/pages/target-thing.tsx`: `<LayoutContent>` around the content, slugs from
   `useSlugs('target')`, other route state via `getRouteApi`. No layout, and no slug props.
2. Add
   `targetThingRoute = createRoute({ getParentRoute: () => targetRoute, path: 'thing', component: TargetThingPage })`
   in `src/routes/target/thing.tsx` and add it to `targetRoute.addChildren([...])` in `tree.ts`. The
   route component is the page itself unless the route carries a parameter of its own, like
   `$schemaCheckId`, which it then passes as a prop.
3. Add the item to the target layout's nav (`src/components/layouts/target.tsx`):
   `{ label: 'Thing', to: '/$organizationSlug/$projectSlug/$targetSlug/thing', params }`. Gate it
   with `visible` if it needs a permission.
4. Tests: `tree.spec.ts` needs the new id in its snapshot and an example URL; `render.spec.ts`'s
   `pages` table gets `{ url, current: 'Thing' }`.

Put a detail page under the tab's path (`thing/$id`) so the item stays current on it.

### Add a section to a settings page (a tertiary nav)

1. Add a route under the settings route: `path: 'thing'`, component rendering the section, and
   `loader: loader => loadSection(loader, 'thing')` (see DATA.md).
2. Add the section to the `sections` table in the settings page (`id`, `label`, `to`) and to the
   page's `*Sections` function under its permission (`settingsSections`,
   `organizationSettingsSections`, `projectSettingsSections`, `membersSections`).
3. If the section replaces an old `?page=thing`, add the value to the matching `legacySearch`
   entry's `values` and an example.
4. Tests: `tree.spec.ts` id + example; a `render.spec.ts` case in that screen's block.

### Give a page sub-pages where one of them has no nav

Follow `src/routes/target/alerts.tsx`: a pathless route (`id: 'with-nav'`, no `path`) renders the
nav around an outlet and holds the pages that share it; the nav-less page is a sibling of the
pathless route. Pathless routes add nothing to the URL, only a segment to route ids.

### Move a URL

1. Change the route's `path` and every typed link to it (the compiler finds them).
2. Add an entry to `legacyPaths` in `src/routes/legacy.ts`: the old `path` under its `parent`, the
   `redirect` to the new shape, an `example`, `since` and `why`. A redirect without `params`
   inherits the old URL's params by name.
3. `legacy.spec.ts` loads the example and asserts it lands; nothing else to write.

A route module that is named as a `parent` in the catalog must not import `legacy.ts` itself (the
two would evaluate in a cycle). Section modules import it; `<area>/route.tsx` modules do not.

### Make an index the default of its parent

An index route (`path: '/'`) renders the default section. If the default must be computed
(`/history` → latest version), put the lookup in the index route's loader, `await` it with
`loadQuery` and throw `redirect`; a default that needs only the URL (`/insights` → its date range)
goes in `beforeLoad`. Do not redirect from a render effect, which races data and can loop.

## Testing

Run from the repo root: `pnpm vitest run packages/web/app/src`.

| Spec                       | Guards                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes/tree.spec.ts`      | The exact set of route ids (inline snapshot) and one example URL per id; a route without an example fails the suite.                                                    |
| `routes/legacy.spec.ts`    | Every catalog entry's example lands on its new URL with a single history entry; the config-dependent redirects.                                                         |
| `routes/render.spec.ts`    | The real tree rendered at every page URL: one secondary nav, the expected item current, no error boundary; per-screen blocks for each tertiary nav and gate.            |
| `router.spec.ts`           | `createAppRouter` has no side effects and owns the default error/not-found boundaries, the pending defaults and `defaultPreload`.                                       |
| `lib/testing/urql.spec.ts` | The test client answers by operation name and fails a fixture that no longer covers its document.                                                                       |
| `routes/<scope>/*.spec.ts` | Per area: what the loaders request, with which variables and policies, that the page reads it from the cache, and where a gate or section check redirects. See DATA.md. |

`renderAtUrl(url, { client })` (`src/lib/testing/router.tsx`) renders the app in a memory history
with `client` (a `createTestClient`) in router context. Specs that use it mock `@/env/frontend`,
`@graphql-hive/laboratory`, the laboratory storage and the session through the stand-ins in
`src/lib/testing/mocks/`, one `vi.mock` line each in the spec, since there is no app-scoped vitest
project to hold `setupFiles`. Fixtures for the viewer, layout and user-menu queries, each settings
and members screen, checks, insights, history, apps, the explorer gates and proposals live in
`src/lib/testing/fixtures/` and are checked against the documents they answer, so a query change
that they no longer cover fails with the missing paths named. The client runs on the app's own
graphcache configuration, so fixtures carry `__typename` on every object below the root.
