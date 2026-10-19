import { defineConfig } from 'react-foundry';
import type { Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

/**
 * `@/env/frontend` validates `window.__ENV` at import time and throws when it is missing, so
 * any preview whose component reaches it (PageLead through DocsLink, for one) fails before it
 * renders. The app sets `__ENV` from a `<script src="/__env.js">` in its index.html; this puts
 * an equivalent inline script at the top of foundry's, with the schema's required keys and the
 * same values as `.env.template`. Nothing in a preview calls these endpoints.
 */
const previewEnv: Plugin = {
  name: 'hive-preview-env',
  transformIndexHtml: () => [
    {
      tag: 'script',
      injectTo: 'head-prepend',
      children: `window.__ENV = ${JSON.stringify({
        ENVIRONMENT: 'development',
        APP_BASE_URL: 'http://localhost:3000',
        GRAPHQL_PUBLIC_ENDPOINT: 'http://localhost:3001/graphql',
        GRAPHQL_PUBLIC_SUBSCRIPTION_ENDPOINT: 'http://localhost:3001/graphql',
        GRAPHQL_PUBLIC_ORIGIN: 'http://localhost:3001',
      })};`,
    },
  ],
};

export default defineConfig({
  // Widened past `ui/primitives/` so real app components can be previewed too, not just
  // design-system primitives. Previews of app components render inside the stand-in router in
  // `foundry.router.tsx` and stand in for query data with `makeFragmentData`.
  previews: 'src/components/**/*.preview.tsx',
  title: 'Hive Console Components',
  // Declaration order is display order, so this groups the shelf by kind rather than
  // alphabetically. It also narrows `NavPath` to these exact paths, which turns a typo in
  // a preview's `nav` export into a type error instead of a stray top-level group.
  nav: [
    {
      label: 'Primitives',
      children: [
        {
          label: 'Foundations',
          children: [{ label: 'Focus' }, { label: 'SemanticColors' }, { label: 'TypeScale' }],
        },
        { label: 'Accordion' },
        { label: 'Avatar' },
        { label: 'Badge' },
        { label: 'Button' },
        { label: 'Card' },
        { label: 'Collapsible' },
        { label: 'CopyChip' },
        { label: 'DescriptionList' },
        { label: 'Input' },
        { label: 'Legend' },
        { label: 'ScrollArea' },
        { label: 'Separator' },
        { label: 'Skeleton' },
        { label: 'Spinner' },
        { label: 'StatusDot' },
        { label: 'Tabs' },
        { label: 'Textarea' },
        {
          label: 'FormControls',
          children: [
            { label: 'Checkbox' },
            { label: 'Form', children: [{ label: 'Component Examples' }] },
            { label: 'Label' },
            { label: 'RadioGroup' },
            { label: 'Slider' },
            { label: 'Switch' },
            { label: 'ToggleGroup' },
          ],
        },
        {
          label: 'Floating',
          children: [
            { label: 'Menu' },
            { label: 'Popover' },
            { label: 'PortalContainer' },
            { label: 'Search' },
            { label: 'Select' },
            { label: 'Tooltip' },
          ],
        },
        {
          label: 'Overlays',
          children: [{ label: 'AlertDialog' }, { label: 'Dialog' }, { label: 'Sheet' }],
        },
        {
          label: 'Feedback',
          children: [{ label: 'Toast' }],
        },
        {
          label: 'Charts',
          children: [{ label: 'Chart' }, { label: 'Sparkline' }, { label: 'TimeSeriesChart' }],
        },
      ],
    },
    // The legacy `ui/` primitives (some formerly in `v2/`) queued for migration to `ui/primitives/`,
    // as they ship today. Each entry transcribes every real call site, so a replacement can be judged
    // against the current thing rather than against invented examples, and so there is a
    // coverage checklist to migrate through. Entries are deleted as their component lands.
    {
      label: 'Inventory',
      children: [{ label: 'Presentational' }, { label: 'V2Leftovers' }],
    },
    // Composites and app components, built from the primitives above. Each preview reproduces
    // real call sites so a primitive change can be judged against the compositions that ship.
    {
      label: 'Components',
      children: [
        { label: 'BillingPlanPicker' },
        { label: 'Calendar' },
        { label: 'ChangesBlock' },
        { label: 'CompositionErrors' },
        { label: 'ContractFailures' },
        { label: 'DataTable' },
        { label: 'DateRangePicker' },
        { label: 'Filters', children: [{ label: 'FilterDropdown' }, { label: 'FilterMenu' }] },
        { label: 'Navigation', children: [{ label: 'Component Examples' }] },
        { label: 'NotFound' },
        { label: 'PageLead' },
        { label: 'PagePending' },
        { label: 'RefreshButton' },
        { label: 'Resizable' },
        { label: 'SchemaChangePaging' },
        { label: 'ScopeBar' },
        { label: 'StatCard' },
        { label: 'Stepper' },
        { label: 'SubgraphName' },
        { label: 'SupportForms' },
        { label: 'TabbedView' },
      ],
    },
  ],
  theme: {
    colors: {
      light: { canvas: 'var(--color-neutral-3)' },
      dark: { canvas: 'var(--color-neutral-2)' },
    },
  },
  viteConfig: {
    // Foundry's vite root is inside node_modules and this config is bundled to a cache
    // dir before it runs, so neither location can anchor tsconfig discovery. cwd is the
    // app directory, which is where `foundry dev` is invoked from.
    plugins: [tsconfigPaths({ root: process.cwd() }), tailwindcss(), previewEnv],
  },
});
