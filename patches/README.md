# Patched dependencies

Each file here is applied by pnpm at install time (`pnpm.patchedDependencies` in `package.json`).
Every key is pinned to an exact version and `ignorePatchFailures: false` is set in
`pnpm-workspace.yaml`, so bumping a patched package fails the install until the patch is re-cut.
That is deliberate: a patch keyed by name only is skipped silently when it stops applying.

Last full audit: 2026-10-01. Keep this list in sync when a patch is added, re-cut or removed.

## `@apollo__federation@0.38.1.patch`

Apollo Federation v1 composition, used by the schema service for projects that have not moved to
native composition. The patch moves fields whose type only exists as an `extend type` into an
extension node so composition does not throw, and de-duplicates repeated errors (#1407).

Retire when Federation v1 support is dropped. The package is frozen at 0.38.1 upstream.

## `@graphiql__react@1.0.0-alpha.4.patch` and `graphiql@4.0.0-alpha.5.patch`

The old GraphiQL laboratory, still reachable through the GraphiQL / Hive Laboratory switch on the
Laboratory page. The patches add `addTab(state)`, `setTabState`,
`updateActiveTabValues({ id, title })`, and reset-instead-of-vanish when the last tab is closed;
those are used by `use-operation-collections-plugin.tsx`, `edit-operation-modal.tsx` and
`target-laboratory.tsx`. The `isMacOs` export exists for the patched `graphiql` bundle itself, and
the `onModifyHeaders` hook in the same patches is unused.

Retire together with the old laboratory.

## `@slonik__pg-driver@48.19.0.patch`

Returns the last result instead of throwing when one query string holds several statements. Roughly
60 of the 130 migrations bundle statements this way. Upstream refused a configuration flag for it
(gajus/slonik#769).

Kept on purpose. The hunk is one line and has needed one re-cut since the slonik 46 upgrade (#7897).
The only way to retire it is rewriting those 60 migrations, which costs more than the patch ever
will.

## `got@14.4.7.patch`

Copies `types` out of `exports` into a top-level `types` field. The services' tsconfig uses
`moduleResolution: node`, which ignores `exports`, so without the patch got is untyped. got 15 and
16 keep `types` inside `exports`.

Retire by moving the services to `moduleResolution: bundler`, which reads `exports` and fits how
tsup bundles them. Until then re-cut on every got bump.

## `mjml-core@4.14.0.patch`

Removes the `html-minifier` import and the `minify` code path from the email renderer. html-minifier
carries an unfixed ReDoS (CVE-2022-37620) that trips scanners, and we never minify. The two
`pnpm.overrides` that drop the dependency from the tree (`mjml-core@4.14.0>html-minifier`,
`mjml-cli@4.14.0>html-minifier`) are documented next to them in `package.json`.

Retire with mjml 5, which replaced html-minifier with htmlnano. Every 4.x release still depends on
html-minifier, so a 4.x bump only re-cuts the patch.

## `oclif@4.22.65.patch`

The CLI build and release tool (`oclif pack`, `upload`, `promote`), not the runtime. Three changes:

1. Drops the git SHA from tarball names and S3 paths, so
   `cli.graphql-hive.com/versions/<v>/hive-v<v>-<platform>-<arch>.tar.gz` and
   `channels/stable/hive-<platform>-<arch>.tar.gz` exist at the paths `install.sh` downloads. oclif
   6 still bakes the SHA in, so this hunk has no upstream replacement.
2. Rewrites the launcher scripts inside the tarball to always run the bundled Node binary.
3. Lets `oclif pack` run without a `package-lock.json` or `npm-shrinkwrap.json`.

Re-cut on every oclif bump; the release workflow depends on 1. Open question from the 2026-10-01
audit: because of 2 the launcher never redirects to the directory `hive update` installs into, so
self-update on tarball installs probably downloads a version that never runs. Unverified.

## `p-cancelable@4.0.1.patch`

A got dependency. Logs instead of throwing when an `onCancel` handler is attached after the promise
settled, a Sentry-noise workaround (#6230).

Retire with got 15 or later, which dropped p-cancelable entirely.
