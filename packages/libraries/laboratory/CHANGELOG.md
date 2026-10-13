# @graphql-hive/laboratory

## 0.4.0

### Minor Changes

- [#8654](https://github.com/graphql-hive/console/pull/8654)
  [`b156ad7`](https://github.com/graphql-hive/console/commit/b156ad73cf8e0a6d114af7438c0ae207f62f4bcb)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Headers set by a preflight script
  now win over the operation's own headers on every path: operation runs, the cURL export and
  introspection. Names compare case-insensitively, so `Authorization` in the operation and
  `authorization` from the script no longer produce a doubled header. Preflight values are sent
  verbatim, never templated. This matches what the GraphiQL tab did.

- [#8654](https://github.com/graphql-hive/console/pull/8654)
  [`b156ad7`](https://github.com/graphql-hive/console/commit/b156ad73cf8e0a6d114af7438c0ae207f62f4bcb)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Preflight scripts now see an
  allow-list of globals, the model the GraphiQL tab used: the JavaScript built-ins, `fetch`, timers,
  `URL`, `TextEncoder`/`TextDecoder`, Web Crypto, `Headers`/`Request`/`Response`, `AbortController`,
  `structuredClone`, `Intl`, typed arrays and `CryptoJS`. Worker internals such as `self`,
  `globalThis`, `postMessage`, `importScripts`, `location`, `navigator`, `indexedDB`, `caches`,
  `WebSocket`, `XMLHttpRequest`, `eval` and `Function` read as `undefined`, and `this` is no longer
  the worker scope. The full list lives in `src/lib/preflight-allowed-globals.ts`.

### Patch Changes

- [#8658](https://github.com/graphql-hive/console/pull/8658)
  [`fcd57a8`](https://github.com/graphql-hive/console/commit/fcd57a8081335902a6b6e3d33c45efe5c67fa78a)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Icon-only controls now have
  accessible names: the left rail (Collections, History, Documentation, Settings), the collections
  pane (add, search clear, edit, save and cancel rename, delete collection, delete operation) and
  the tab close control, which is now a real button. Tabs expose `data-state="active" | "inactive"`,
  and preflight log lines carry `data-level` inside a `role="log"` list. The Settings rail button no
  longer toggles the history panel when clicked.

- [#8658](https://github.com/graphql-hive/console/pull/8658)
  [`fcd57a8`](https://github.com/graphql-hive/console/commit/fcd57a8081335902a6b6e3d33c45efe5c67fa78a)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Hosts can hand persisted ids back
  to the lab: `onCollectionCreate` and `onCollectionOperationCreate` may return `{ id }`, or a
  promise of it, and the lab adopts the id for the collection, the saved operation, its working copy
  and its tab. Operations a collection is created with are now reported through
  `onCollectionOperationCreate` as well. Before this, a collection created in the current session
  kept a local id, so saving operations into it, renaming it or deleting it could not reach the
  host's store until the page was reloaded.

- [#8654](https://github.com/graphql-hive/console/pull/8654)
  [`b156ad7`](https://github.com/graphql-hive/console/commit/b156ad73cf8e0a6d114af7438c0ae207f62f4bcb)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Preflight console arguments are
  converted to text inside the worker, so logging a function, `lab` or `lab.request.headers` no
  longer fails the run with a clone error. A script that throws a non-Error value now reports it
  instead of waiting for the timeout.

- [#8654](https://github.com/graphql-hive/console/pull/8654)
  [`b156ad7`](https://github.com/graphql-hive/console/commit/b156ad73cf8e0a6d114af7438c0ae207f62f4bcb)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Restore `lab.CryptoJS` in
  preflight scripts. It had been dropped from the `lab` object, so only the bare `CryptoJS` global
  worked and scripts written for the GraphiQL tab failed on `lab.CryptoJS.*`, even though the editor
  typings offered it. The typings also accept numbers, booleans and `null` in `lab.environment.set`,
  as the runtime always did.

- [#8654](https://github.com/graphql-hive/console/pull/8654)
  [`b156ad7`](https://github.com/graphql-hive/console/commit/b156ad73cf8e0a6d114af7438c0ae207f62f4bcb)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - A disabled preflight no longer
  clears the stored environment and plugin state. Introspection and operation runs keep
  interpolating `{{variables}}` from them while the toggle is off, as the GraphiQL tab did.

## 0.3.2

### Patch Changes

- [#8630](https://github.com/graphql-hive/console/pull/8630)
  [`9ca986d`](https://github.com/graphql-hive/console/commit/9ca986da183efd20fe3b1ab6630eade3865be470)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Accept `lucide-react` 1.x as a
  peer dependency alongside 0.548.

- [#8638](https://github.com/graphql-hive/console/pull/8638)
  [`338c7cb`](https://github.com/graphql-hive/console/commit/338c7cbc3077e152e88e5b315bb25522757b4734)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Upgrade the bundled
  `react-resizable-panels` behind the laboratory's split panes to v4. Dragging, keyboard resizing
  and limits behave as before; double-clicking a divider now resets the split.

## 0.3.1

### Patch Changes

- [#8607](https://github.com/graphql-hive/console/pull/8607)
  [`b936b9a`](https://github.com/graphql-hive/console/commit/b936b9a23f7193fcfb17f85bb38f7cf26f148819)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p).

## 0.3.0

### Minor Changes

- [#8450](https://github.com/graphql-hive/console/pull/8450)
  [`017aee2`](https://github.com/graphql-hive/console/commit/017aee21212244951cc8643d93b5d33d1a0f4a6e)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Union and interface fields are
  now expandable in the query builder: each abstract field lists its possible types as a
  `... on Type` row, with `__typename` selected automatically so the operation stays valid.
  Previously an abstract field was written with no selection set and servers rejected the request.
  Search now finds fields inside those branches, and a field selected inside a hand-written inline
  fragment checks the row under its own type rather than the parent's.

## 0.2.7

### Patch Changes

- [#8440](https://github.com/graphql-hive/console/pull/8440)
  [`f9baa80`](https://github.com/graphql-hive/console/commit/f9baa802e523eba58bea99e77cad83269033b1ed)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Make Stop cancel a running
  subscription on every transport. Cancellation relied on the executor honouring `request.signal`,
  which `@graphql-tools/executor-legacy-ws` does not, so stopping a `LEGACY_WS` subscription did
  nothing and the run kept rendering events until the server completed on its own. The stream is now
  ended from the laboratory side as well.

## 0.2.6

### Patch Changes

- [#8369](https://github.com/graphql-hive/console/pull/8369)
  [`dc32e0b`](https://github.com/graphql-hive/console/commit/dc32e0b43081f87cf6f41a820e5e6e76cd4aa687)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-yoga package to patch vulnerability

## 0.2.5

### Patch Changes

- [#8363](https://github.com/graphql-hive/console/pull/8363)
  [`1f7c817`](https://github.com/graphql-hive/console/commit/1f7c8177bd945b614ec18bee909b88c374b1f2ed)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7).

## 0.2.4

### Patch Changes

- [#8355](https://github.com/graphql-hive/console/pull/8355)
  [`b8b4499`](https://github.com/graphql-hive/console/commit/b8b4499af882ae6f711d6553957105120d98fd31)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Lab: Add a schema documentation
  pane, opt-in via the new `enableDocs` prop.

  When enabled, a third icon appears in the left rail and opens documentation in the same slot as
  Collections and History: browse root types, types and fields, search across the whole type map
  (including input objects and enum values), and read descriptions, deprecations and argument
  defaults. Builder rows gain an "Open in Docs" context menu entry, and the GraphQL editor hover
  gains an "Open in Docs" link. `renderLaboratory` enables the pane by default, so standalone
  embedders of the UMD bundle get it without passing `enableDocs`.

  `enableDocs` also decides whether introspection asks for descriptions, so a host that supplies
  `defaultSchemaIntrospection` must build it with descriptions itself. Building it with
  `introspectionFromSchema` does that by default.

  **Removed:** the `introspection.schemaDescription` setting and its toggle in the settings dialog.
  It was wired to graphql-js's `descriptions` option rather than `schemaDescription`, and defaulted
  to `false` where graphql-js defaults to `true`, so nothing rendered descriptions and the toggle
  had no discoverable effect. Descriptions now follow `enableDocs`. `render-laboratory` no longer
  maps Yoga's `schemaDescription` option.

- [#8357](https://github.com/graphql-hive/console/pull/8357)
  [`ee824bd`](https://github.com/graphql-hive/console/commit/ee824bd3fb254d65f16340296b19930dd53f4a50)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Laboratory: restore preflight
  behaviour that was lost when the lab moved into this package, and stop a script from being able to
  wedge a run.

  - `lab.prompt(title, defaultValue, { placeholder, description })`. **The first argument is now the
    field label rather than the input's placeholder**.
  - `lab.environment.set()` accepts strings, numbers, booleans and `null`; anything else is dropped
    with a warning, since environment values are interpolated into headers as text.
  - New `preflightNotice` prop. The preflight editor warns that scripts run in the reader's browser;
    hosts that share one script between people should say so here.

## 0.2.3

### Patch Changes

- [#8291](https://github.com/graphql-hive/console/pull/8291)
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use npm trusted publishing.

## 0.2.2

### Patch Changes

- [#8292](https://github.com/graphql-hive/console/pull/8292)
  [`e8e2a9e`](https://github.com/graphql-hive/console/commit/e8e2a9eb660e19e8eff5f77ff14a90de7694c064)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Laboratory: Harden builder merge
  code so that toggles don't cause a view reset

## 0.2.1

### Patch Changes

- [#8266](https://github.com/graphql-hive/console/pull/8266)
  [`5cb4487`](https://github.com/graphql-hive/console/commit/5cb44871271713c0804b7f9393e5b8c7ad67521e)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Laboratory: Fix hovers, tooltips
  and several builder defects, and add copy as cURL, a reload-schema button and an introspection
  polling toggle.

  **Added**

  - Copy as cURL in the operation toolbar.
  - A reload-schema button in the builder, which introspects over the network even when a schema was
    supplied by the host, and spins while the request is in flight. It replaces the previous
    "restore default endpoint" button; `restoreDefaultEndpoint` remains available on the API.
  - `introspection.pollSchema` setting to turn off the 5 second introspection poll and refresh the
    schema only on demand.
  - `enableFullScreen` prop (default `true`) so hosts that already fill the viewport can hide the
    full screen control.
  - The Query Plan tab is now always shown, with an empty state explaining that plans appear when
    the gateway returns `extensions.queryPlan`.

  **Fixed**

  - The builder no longer collapses expanded fields while introspection is polling. An unchanged
    schema previously produced a new `GraphQLSchema` on every poll, resetting expansion to the depth
    of the current document.
  - Editor hovers now appear on mouse over, so validation messages and schema documentation are
    readable.
  - Monaco's folding chevrons render as icons instead of empty squares. Font faces are now
    registered on the document, where browsers resolve them, rather than inside the shadow root
    where they are ignored.
  - Response size is shown in real units instead of always reading `0KB`, and is measured in UTF-8
    bytes.
  - Tooltips attached with `asChild` now appear. `Button`, `TooltipTrigger` and `AlertDialogTrigger`
    did not forward refs, leaving the tooltip without an element to anchor to.
  - The builder's tree/list toggle is controlled, cannot be deselected into an empty state, and is
    disabled with an explanation until a search is active.
  - The Query Plan panel no longer throws while rendering when a response body is not JSON.
  - monaco-graphql is initialized once and updated in place, so variables validation registers
    regardless of which editor mounts first and survives an endpoint change.
  - Removed invalid nested buttons in builder and collection rows, which also makes the collection
    edit and delete actions keyboard reachable.
  - The query plan visualization no longer updates state during render.

## 0.2.0

### Minor Changes

- [#8206](https://github.com/graphql-hive/console/pull/8206)
  [`481f356`](https://github.com/graphql-hive/console/commit/481f356e7e0acf509e3e309c992e3c0ba5e9a955)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Remove the request `retry`
  setting from the laboratory. Retries are the wrong primitive for an interactive GraphQL IDE (the
  user re-runs operations, and schema introspection already polls), and the underlying HTTP executor
  retried on any GraphQL `errors` response while dropping request headers on the retry, so retries
  went out unauthenticated. Existing persisted `retry` values are ignored automatically.

## 0.1.9

### Patch Changes

- [#8167](https://github.com/graphql-hive/console/pull/8167)
  [`6e9a210`](https://github.com/graphql-hive/console/commit/6e9a21009ca2754b8237da4afac1115d339be8d2)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Bump bundled `graphql` from `^16.12.0`
  to `^16.14.0` to fix "Unexpected invariant triggered" error in the schema explorer when
  introspecting servers running graphql-js 16.14+. graphql-js 16.14.0 added `DIRECTIVE_DEFINITION`
  to the `@deprecated` directive's introspection locations; the previously bundled 16.12.0 did not
  recognise this enum value, making the Laboratory unusable against any such server.

## 0.1.8

### Patch Changes

- [#8024](https://github.com/graphql-hive/console/pull/8024)
  [`0e3ce40`](https://github.com/graphql-hive/console/commit/0e3ce400706c625925161f8d59cc5691380cef07)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Hive laboratory introspection query to
  include active tab headers

## 0.1.7

### Patch Changes

- [#8012](https://github.com/graphql-hive/console/pull/8012)
  [`16a03c8`](https://github.com/graphql-hive/console/commit/16a03c8f2cad3c9a3693d69a8ffbd916e9ea8008)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Better reasons for abort controllers in
  lab

- [#8003](https://github.com/graphql-hive/console/pull/8003)
  [`bea8b7c`](https://github.com/graphql-hive/console/commit/bea8b7c4f62be5e704c8709a50ae3ea7d0466fe3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## 0.1.6

### Patch Changes

- [#7998](https://github.com/graphql-hive/console/pull/7998)
  [`20b6892`](https://github.com/graphql-hive/console/commit/20b689279f3e8203f5568908b7452324c1c75019)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Proper handling of flatter/condition as
  high order nodes to not break lab qp

## 0.1.5

### Patch Changes

- [#7989](https://github.com/graphql-hive/console/pull/7989)
  [`863f920`](https://github.com/graphql-hive/console/commit/863f920b86505a3d84c9001fef1c3e8a723bdca9)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Enhanced behavior when no collection
  exists and the user attempts to save an operation, along with the ability to edit the collection
  name.

## 0.1.4

### Patch Changes

- [#7963](https://github.com/graphql-hive/console/pull/7963)
  [`4a8bd4f`](https://github.com/graphql-hive/console/commit/4a8bd4fd1b4fbb34076e97d06ed1341432de451d)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Implemented functionality that allows
  to have multiple queries in same operation while working only with focused one (run button, query
  builder)

- [#7892](https://github.com/graphql-hive/console/pull/7892)
  [`fab4b03`](https://github.com/graphql-hive/console/commit/fab4b03ace2ff20759bbcd33465d00a5cbbc4c97)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Hive Laboratory renders Hive Router
  query plan if included in response extensions

## 0.1.3

### Patch Changes

- [#7888](https://github.com/graphql-hive/console/pull/7888)
  [`574a5d8`](https://github.com/graphql-hive/console/commit/574a5d823e71ca1d0628897a73e2fab1d0d5bfe0)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - If schema introspection isn't provided
  as property to Laboratory, lab will start interval to fetch schema every second.

## 0.1.2

### Patch Changes

- [#7849](https://github.com/graphql-hive/console/pull/7849)
  [`b908773`](https://github.com/graphql-hive/console/commit/b908773ce02340d71de9cbec5e26109a57111164)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - replace crypto.randomUUID with uuid to
  make it works on http

- [#7835](https://github.com/graphql-hive/console/pull/7835)
  [`7f58cb8`](https://github.com/graphql-hive/console/commit/7f58cb856bf55c8ec7d3fc248adeb00a94290874)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Enhancement: Implemented search field
  for query builder in new lab, with two modes: list and tree

## 0.1.1

### Patch Changes

- [#7839](https://github.com/graphql-hive/console/pull/7839)
  [`9585f11`](https://github.com/graphql-hive/console/commit/9585f11ef26db9ec9a3cb92d3758d1cf9e5655b7)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - exposed renderLaboratory function to
  use window location as default endpoint

## 0.1.0

### Minor Changes

- [#7697](https://github.com/graphql-hive/console/pull/7697)
  [`1bf05f0`](https://github.com/graphql-hive/console/commit/1bf05f048fb599fe02fb9ef16825d156c0f29168)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - First release
