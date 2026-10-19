import { ChartPieIcon, FileDiffIcon, ListIcon, PencilIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { RouterAt } from '../../../../foundry.router';
import { Button } from '../primitives/button/button';
import { Navigation, type NavigationItem } from './navigation';
import * as styles from './navigation.preview.css';

export const nav: NavPath = 'Components/Navigation';

/**
 * Links between the pages of one area. The router decides which link is current from the URL, so
 * every story below renders inside a stand-in router positioned at a page (`RouterAt`); there is
 * no prop that names the current item. Three shapes: the underline bar under the org, project and
 * target headers, the pill filter, and the vertical list beside a settings page.
 */

const TARGET = {
  organizationSlug: 'the-guild',
  projectSlug: 'gateway',
  targetSlug: 'production',
};
const TARGET_PATH = '/the-guild/gateway/production';

const TARGET_ITEMS: NavigationItem[] = [
  // The root item: without `exact` its path is a prefix of every other target page.
  {
    label: 'Schema',
    to: '/$organizationSlug/$projectSlug/$targetSlug',
    params: TARGET,
    exact: true,
  },
  {
    label: 'Checks',
    to: '/$organizationSlug/$projectSlug/$targetSlug/checks',
    params: TARGET,
  },
  {
    label: 'Explorer',
    to: '/$organizationSlug/$projectSlug/$targetSlug/explorer',
    params: TARGET,
  },
  {
    label: 'Insights',
    to: '/$organizationSlug/$projectSlug/$targetSlug/insights',
    params: TARGET,
  },
  {
    label: 'Apps',
    to: '/$organizationSlug/$projectSlug/$targetSlug/apps',
    params: TARGET,
  },
  {
    label: 'Settings',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
    params: TARGET,
  },
];

/** The bar on a nested page: Checks is current on a single check because its path is a prefix. */
export const Bar = createPreview(() => (
  <RouterAt path={`${TARGET_PATH}/checks/abc123`}>
    <Navigation aria-label="Target" items={TARGET_ITEMS} />
  </RouterAt>
));

/** The same bar at the target root: only the `exact` item is current, even with search params. */
export const RootItem = createPreview(() => (
  <RouterAt path={`${TARGET_PATH}?service=users`}>
    <Navigation aria-label="Target" items={TARGET_ITEMS} />
  </RouterAt>
));

const EXPLORER_ITEMS: NavigationItem[] = [
  {
    label: 'All',
    tooltip: 'Shows all types, including unused and deprecated ones',
    to: '/$organizationSlug/$projectSlug/$targetSlug/explorer',
    params: TARGET,
    exact: true,
  },
  {
    label: 'Unused',
    tooltip: 'Shows only types that are not used in any operation',
    to: '/$organizationSlug/$projectSlug/$targetSlug/explorer/unused',
    params: TARGET,
  },
  {
    label: 'Deprecated',
    tooltip: 'Shows only types that are marked as deprecated',
    to: '/$organizationSlug/$projectSlug/$targetSlug/explorer/deprecated',
    params: TARGET,
  },
];

/** Three routes as a pill, each explained on hover: the explorer's type filter. */
export const Pill = createPreview(() => (
  <RouterAt path={`${TARGET_PATH}/explorer/unused`}>
    <Navigation aria-label="Type filter" variant="pill" size="sm" items={EXPLORER_ITEMS} />
  </RouterAt>
));

const PROPOSAL = { ...TARGET, proposalId: 'pr-7' };
const PROPOSAL_PATH = `${TARGET_PATH}/proposals/pr-7`;
const proposalLink = {
  to: '/$organizationSlug/$projectSlug/$targetSlug/proposals/$proposalId',
  params: PROPOSAL,
} as const;

const PROPOSAL_ITEMS: NavigationItem[] = [
  // The default section has no marker in the URL, so its link clears `page` and is current only
  // while the URL has no `page` at all.
  {
    ...proposalLink,
    label: 'Details',
    icon: ListIcon,
    search: { page: undefined, version: 'v3' },
    explicitUndefined: true,
  },
  {
    ...proposalLink,
    label: 'Schema',
    icon: FileDiffIcon,
    search: { page: 'schema', version: 'v3' },
  },
  {
    ...proposalLink,
    label: 'Checks',
    icon: ChartPieIcon,
    search: { page: 'checks', version: 'v3' },
  },
  { ...proposalLink, label: 'Edit', icon: PencilIcon, search: { page: 'edit' } },
];

/** Sections driven by a search param, with icons, at sm: the proposal page on its default section. */
export const SectionsDefault = createPreview(() => (
  <RouterAt path={`${PROPOSAL_PATH}?version=v3`}>
    <Navigation aria-label="Proposal" size="sm" items={PROPOSAL_ITEMS} />
  </RouterAt>
));

/** The same sections with `?page=schema` in the URL. */
export const SectionsSchema = createPreview(() => (
  <RouterAt path={`${PROPOSAL_PATH}?page=schema&version=v3`}>
    <Navigation aria-label="Proposal" size="sm" items={PROPOSAL_ITEMS} />
  </RouterAt>
));

const ALERTS_ITEMS: NavigationItem[] = [
  {
    label: 'Alert activity',
    to: '/$organizationSlug/$projectSlug/$targetSlug/alerts',
    params: TARGET,
    exact: true,
  },
  {
    label: 'Alert rules',
    to: '/$organizationSlug/$projectSlug/$targetSlug/alerts/rules',
    params: TARGET,
    attrs: { 'data-cy': 'alerts-rules-link' },
  },
  {
    label: 'Create a new alert',
    to: '/$organizationSlug/$projectSlug/$targetSlug/alerts/create',
    params: TARGET,
  },
];

/** The vertical list beside a page with sections: the alerts pages, on Rules. */
export const List = createPreview(() => (
  <RouterAt path={`${TARGET_PATH}/alerts/rules`}>
    <Navigation aria-label="Alerts" variant="list" items={ALERTS_ITEMS} />
  </RouterAt>
));

/** While the page that owns the links still loads, placeholders hold the space. */
export const Loading = createPreview(() => (
  <div className={styles.div}>
    <Navigation items={TARGET_ITEMS} loading />
    <Navigation variant="list" items={ALERTS_ITEMS} loading />
  </div>
));

/** An action at the bar's far edge, outside the nav. */
export const WithActions = createPreview(() => (
  <RouterAt path={`${TARGET_PATH}/insights`}>
    <Navigation
      aria-label="Target"
      items={TARGET_ITEMS}
      actions={<Button variant="ghost">Connect to CDN</Button>}
    />
  </RouterAt>
));

/** An item a permission hides is left out, as the layouts do for pages a viewer cannot see. */
export const Gated = createPreview(() => (
  <RouterAt path={`${TARGET_PATH}/checks`}>
    <Navigation
      aria-label="Target"
      items={TARGET_ITEMS.map(item => ({ ...item, visible: item.label !== 'Settings' }))}
    />
  </RouterAt>
));

export const Playground = createPreview({
  controls: controlsFor(Navigation, {
    variant: { type: 'radio', options: ['underline', 'pill', 'list'], default: 'underline' },
    size: { type: 'radio', options: ['default', 'sm'], default: 'default' },
    loading: { type: 'boolean', default: false },
  }),
  render: v => (
    <RouterAt path={`${TARGET_PATH}/checks`}>
      <Navigation
        aria-label="Target"
        items={TARGET_ITEMS}
        variant={v.variant}
        size={v.size}
        loading={v.loading}
      />
    </RouterAt>
  ),
});
