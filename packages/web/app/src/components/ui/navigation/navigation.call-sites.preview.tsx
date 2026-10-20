import { ChartPieIcon, FileDiffIcon, LinkIcon, ListIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import { CallSite, CallSiteGroup, InventoryList } from '@/components/inventory/shared';
import { SecondaryNavigation } from '@/components/navigation/secondary-navigation';
import { GraphQLIcon } from '@/components/ui/brand-icon';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-content-layout';
import { Button } from '@/components/ui/primitives/button/button';
import { RouterAt } from '../../../../foundry.router';
import { Navigation, type NavigationItem } from './navigation';

export const nav: NavPath = 'Components/Navigation/Component Examples';

/**
 * Every mount of the router-inferred nav, drawn with its real labels, at a real URL, with the
 * chrome around it. The layouts gate items on permissions and run the layout query, so the items
 * are listed as a viewer with every permission sees them. Two things differ from the current
 * sources on purpose: root items carry `exact`, and no item names the current page.
 */

const ENTRIES = [
  {
    source: 'components/navigation/secondary-navigation.tsx:5',
    origin: 'base',
    what: 'The bar under the organization, project and target headers, mounted by the three layouts',
    coveredBy: 'Bars',
  },
  {
    source: 'components/target/explorer/filter.tsx:66',
    origin: 'base',
    what: 'All, Unused and Deprecated as three routes, a pill with a tooltip per link',
    coveredBy: 'Explorer filter',
  },
  {
    source: 'pages/target-proposal.tsx:564',
    origin: 'base',
    what: 'The sections of one proposal, driven by ?page=, with icons, at sm',
    coveredBy: 'Proposal sections',
  },
  {
    source: 'pages/target-alerts.tsx:25',
    origin: 'base',
    what: 'Activity, Rules and Create beside the alerts page, as a list',
    coveredBy: 'Alerts sections',
  },
  {
    source: 'pages/target-settings.tsx:1350',
    origin: 'base',
    what: 'The settings sections of a target, gated on permissions and project type',
    coveredBy: 'Settings sections',
  },
  {
    source: 'pages/organization-settings.tsx:581',
    origin: 'base',
    what: 'The settings sections of an organization',
    coveredBy: 'Settings sections',
  },
  {
    source: 'pages/project-settings.tsx:523',
    origin: 'base',
    what: 'The settings sections of a project',
    coveredBy: 'Settings sections',
  },
  {
    source: 'pages/organization-members.tsx:120',
    origin: 'base',
    what: 'Members, Roles, Groups and Invitations of an organization',
    coveredBy: 'Members sections',
  },
] as const;

export const Inventory = createPreview({
  label: 'Inventory',
  render: () => (
    <InventoryList
      component="base/navigation/navigation"
      summary={
        <>
          Eight mounts in three shapes, all on the base component: the three layout bars and the
          explorer filter, the proposal sections driven by a search param, and the five vertical
          lists (alerts, three settings pages, members) on <code>variant="list"</code>.
        </>
      }
      entries={ENTRIES}
    />
  ),
});

const ORGANIZATION = { organizationSlug: 'the-guild' };
const PROJECT = { ...ORGANIZATION, projectSlug: 'gateway' };
const TARGET = { ...PROJECT, targetSlug: 'production' };
const TARGET_PATH = '/the-guild/gateway/production';

const ORGANIZATION_LINKS: NavigationItem[] = [
  {
    label: 'Overview',
    to: '/$organizationSlug',
    params: ORGANIZATION,
    exact: true,
  },
  { label: 'Members', to: '/$organizationSlug/view/members', params: ORGANIZATION },
  {
    label: 'Settings',
    to: '/$organizationSlug/view/settings',
    params: ORGANIZATION,
  },
  { label: 'Support', to: '/$organizationSlug/view/support', params: ORGANIZATION },
  {
    label: 'Subscription',
    to: '/$organizationSlug/view/subscription',
    params: ORGANIZATION,
  },
];

const PROJECT_LINKS: NavigationItem[] = [
  {
    label: 'Targets',
    to: '/$organizationSlug/$projectSlug',
    params: PROJECT,
    exact: true,
  },
  {
    label: 'Alerts',
    to: '/$organizationSlug/$projectSlug/view/alerts',
    params: PROJECT,
  },
  {
    label: 'Settings',
    to: '/$organizationSlug/$projectSlug/view/settings',
    params: PROJECT,
  },
];

const TARGET_LINKS: NavigationItem[] = [
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
    label: 'History',
    to: '/$organizationSlug/$projectSlug/$targetSlug/history/$versionId',
    params: { ...TARGET, versionId: 'v42' },
  },
  {
    label: 'Insights',
    to: '/$organizationSlug/$projectSlug/$targetSlug/insights',
    params: TARGET,
    search: {},
  },
  {
    label: 'Traces',
    to: '/$organizationSlug/$projectSlug/$targetSlug/traces',
    params: TARGET,
  },
  {
    label: 'Apps',
    to: '/$organizationSlug/$projectSlug/$targetSlug/apps',
    params: TARGET,
  },
  {
    label: 'Laboratory',
    to: '/$organizationSlug/$projectSlug/$targetSlug/laboratory',
    params: TARGET,
  },
  {
    label: 'Proposals',
    to: '/$organizationSlug/$projectSlug/$targetSlug/proposals',
    params: TARGET,
  },
  {
    label: 'Alerts',
    to: '/$organizationSlug/$projectSlug/$targetSlug/alerts',
    params: TARGET,
  },
  {
    label: 'Settings',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
    params: TARGET,
  },
];

export const Bars = createPreview({
  label: 'Bars',
  render: () => (
    <div className="-mx-6 flex flex-col gap-8">
      <CallSite
        source="components/layouts/organization.tsx:115"
        origin="base"
        note="On /the-guild/view/members?page=roles. Members, Settings, Support and Subscription are each gated on a permission; the action is gated on creating projects. Members no longer carries search={{ page: 'list' }}: the router would count it current only on that exact page."
      >
        <RouterAt path="/the-guild/view/members?page=roles">
          <SecondaryNavigation
            links={ORGANIZATION_LINKS}
            actions={
              <Button variant="link">
                <span className="flex items-center">
                  <PlusIcon size={16} className="mr-2" />
                  New project
                </span>
              </Button>
            }
          />
        </RouterAt>
      </CallSite>
      <CallSite
        source="components/layouts/project.tsx:120"
        origin="base"
        note="On /the-guild/gateway?search=prod, the project root with a search param: Targets is current because it is exact on the path only. Alerts and Settings gated; the action is gated on creating targets."
      >
        <RouterAt path="/the-guild/gateway?search=prod">
          <SecondaryNavigation
            links={PROJECT_LINKS}
            actions={
              <Button variant="link">
                <span className="flex items-center">
                  <PlusIcon size={16} className="mr-2" />
                  New target
                </span>
              </Button>
            }
          />
        </RouterAt>
      </CallSite>
      <CallSite
        source="components/layouts/target.tsx:144"
        origin="base"
        note="On a single check. Eleven pages, six of them gated. History still links to the latest version's URL, so it is current only there; it moves to the bare /history path with the URL changes. Connect to CDN shows when the CDN is enabled and hides below md."
      >
        <RouterAt path={`${TARGET_PATH}/checks/abc123`}>
          <SecondaryNavigation
            links={TARGET_LINKS}
            actions={
              <div className="hidden md:block">
                <Button variant="link">
                  <span className="flex items-center whitespace-nowrap">
                    <LinkIcon size={16} className="mr-2" />
                    Connect to CDN
                  </span>
                </Button>
              </div>
            }
          />
        </RouterAt>
      </CallSite>
      <CallSite
        source="the same, while the layout query is in flight"
        origin="base"
        note="Placeholders hold the bar's height until the organization, project and target resolve."
      >
        <SecondaryNavigation loading links={[]} />
      </CallSite>
    </div>
  ),
});

export const ExplorerFilter = createPreview({
  label: 'Explorer filter',
  render: () => (
    <CallSite
      source="components/target/explorer/filter.tsx:66"
      origin="base"
      note="On /explorer/unused, beside the Explore Schema heading. The links carry the current search so the period and filters survive the switch; All is exact because its path prefixes the other two."
    >
      <RouterAt path={`${TARGET_PATH}/explorer/unused`}>
        <Navigation
          aria-label="Type filter"
          variant="pill"
          size="sm"
          items={[
            {
              label: 'All',
              tooltip: 'Shows all types, including unused and deprecated ones',
              to: '/$organizationSlug/$projectSlug/$targetSlug/explorer',
              params: TARGET,
              search: {},
              exact: true,
            },
            {
              label: 'Unused',
              tooltip: 'Shows only types that are not used in any operation',
              to: '/$organizationSlug/$projectSlug/$targetSlug/explorer/unused',
              params: TARGET,
              search: {},
            },
            {
              label: 'Deprecated',
              tooltip: 'Shows only types that are marked as deprecated',
              to: '/$organizationSlug/$projectSlug/$targetSlug/explorer/deprecated',
              params: TARGET,
              search: {},
            },
          ]}
        />
      </RouterAt>
    </CallSite>
  ),
});

const PROPOSAL = { ...TARGET, proposalId: 'pr-7' };
const proposalLink = {
  to: '/$organizationSlug/$projectSlug/$targetSlug/proposals/$proposalId',
  params: PROPOSAL,
} as const;
const versionSearch = { version: 'v3' };

const PROPOSAL_SECTIONS: NavigationItem[] = [
  {
    ...proposalLink,
    label: 'Details',
    icon: ListIcon,
    search: { page: undefined, ...versionSearch },
    explicitUndefined: true,
  },
  {
    ...proposalLink,
    label: 'Schema',
    icon: FileDiffIcon,
    search: { page: 'schema', ...versionSearch },
  },
  {
    ...proposalLink,
    label: 'Supergraph Preview',
    icon: GraphQLIcon,
    visible: true,
    search: { page: 'supergraph', ...versionSearch },
  },
  {
    ...proposalLink,
    label: 'Checks',
    icon: ChartPieIcon,
    search: { page: 'checks', ...versionSearch },
  },
  // Edit always refers to the latest version, so it carries no version.
  { ...proposalLink, label: 'Edit', icon: PencilIcon, search: { page: 'edit' } },
];

export const ProposalSections = createPreview({
  label: 'Proposal sections',
  render: () => (
    <div className="flex flex-col gap-8">
      <CallSite
        source="pages/target-proposal.tsx:564"
        origin="base"
        note="On /proposals/pr-7?version=v3: the default section has no page param, so Details links to page: undefined and is current only while the URL has none. Supergraph Preview only on a distributed graph. The page draws the 1px row line under it."
      >
        <RouterAt path={`${TARGET_PATH}/proposals/pr-7?version=v3`}>
          <div className="w-full">
            <div className="border-b border-line">
              <Navigation aria-label="Proposal" items={PROPOSAL_SECTIONS} size="sm" />
            </div>
          </div>
        </RouterAt>
      </CallSite>
      <CallSite source="the same" origin="base" note="On ?page=checks&version=v3.">
        <RouterAt path={`${TARGET_PATH}/proposals/pr-7?page=checks&version=v3`}>
          <div className="w-full">
            <div className="border-b border-line">
              <Navigation aria-label="Proposal" items={PROPOSAL_SECTIONS} size="sm" />
            </div>
          </div>
        </RouterAt>
      </CallSite>
    </div>
  ),
});

function SectionsPage(props: { path: string; items: NavigationItem[]; label: string }) {
  return (
    <RouterAt path={props.path}>
      <PageLayout>
        <Navigation aria-label={props.label} variant="list" items={props.items} />
        <PageLayoutContent>
          <div className="h-40 rounded-md bg-neutral-3" />
        </PageLayoutContent>
      </PageLayout>
    </RouterAt>
  );
}

export const AlertsSections = createPreview({
  label: 'Alerts sections',
  render: () => (
    <CallSite
      source="pages/target-alerts.tsx"
      origin="base"
      note="On /alerts/rules. Activity is the bare alerts URL, so it is exact."
    >
      <SectionsPage
        label="Alerts"
        path={`${TARGET_PATH}/alerts/rules`}
        items={[
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
          },
          {
            label: 'Create a new alert',
            to: '/$organizationSlug/$projectSlug/$targetSlug/alerts/create',
            params: TARGET,
          },
        ]}
      />
    </CallSite>
  ),
});

const TARGET_SETTINGS: NavigationItem[] = [
  {
    label: 'General',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
    params: TARGET,
    exact: true,
    attrs: { 'data-cy': 'target-settings-general-link' },
  },
  {
    label: 'Base Schema',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/base-schema',
    params: TARGET,
    attrs: { 'data-cy': 'target-settings-base-schema-link' },
  },
  {
    label: 'Breaking Changes',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/breaking-changes',
    params: TARGET,
    attrs: { 'data-cy': 'target-settings-breaking-changes-link' },
  },
  {
    label: 'Schema Contracts',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/schema-contracts',
    params: TARGET,
    attrs: { 'data-cy': 'target-settings-schema-contracts-link' },
  },
  {
    label: 'Registry Tokens',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/registry-token',
    params: TARGET,
    attrs: { 'data-cy': 'target-settings-registry-token-link' },
  },
  {
    label: 'CDN Tokens',
    to: '/$organizationSlug/$projectSlug/$targetSlug/settings/cdn',
    params: TARGET,
    attrs: { 'data-cy': 'target-settings-cdn-link' },
  },
];

const ORGANIZATION_SETTINGS: NavigationItem[] = [
  {
    label: 'General',
    to: '/$organizationSlug/view/settings',
    params: ORGANIZATION,
    exact: true,
  },
  {
    label: 'Policy',
    to: '/$organizationSlug/view/settings/policy',
    params: ORGANIZATION,
  },
  {
    label: 'SSO / SCIM',
    to: '/$organizationSlug/view/settings/sso',
    params: ORGANIZATION,
  },
  {
    label: 'Access Tokens',
    to: '/$organizationSlug/view/settings/access-tokens',
    params: ORGANIZATION,
  },
  {
    label: 'Personal Access Tokens',
    to: '/$organizationSlug/view/settings/personal-access-tokens',
    params: ORGANIZATION,
  },
];

const PROJECT_SETTINGS: NavigationItem[] = [
  {
    label: 'General',
    to: '/$organizationSlug/$projectSlug/view/settings',
    params: PROJECT,
    exact: true,
  },
  {
    label: 'Policy',
    to: '/$organizationSlug/$projectSlug/view/settings/policy',
    params: PROJECT,
  },
  {
    label: 'Composition',
    to: '/$organizationSlug/$projectSlug/view/settings/composition',
    params: PROJECT,
  },
  {
    label: 'Access Tokens',
    to: '/$organizationSlug/$projectSlug/view/settings/access-tokens',
    params: PROJECT,
  },
];

export const SettingsSections = createPreview({
  label: 'Settings sections',
  render: () => (
    <div className="flex flex-col gap-8">
      <CallSiteGroup label="Sections become child routes; the bare settings URL is General, so General is exact.">
        <CallSite
          source="pages/target-settings.tsx:1350"
          origin="base"
          note="On /settings/cdn. Base Schema on non-federation projects, Schema Contracts on federation; Registry and CDN Tokens gated. Each link keeps its data-cy, which the usage e2e clicks."
        >
          <SectionsPage
            label="Settings"
            path={`${TARGET_PATH}/settings/cdn`}
            items={TARGET_SETTINGS}
          />
        </CallSite>
        <CallSite
          source="pages/organization-settings.tsx:581"
          origin="base"
          note="On the bare /view/settings: General is current and no other item is, despite sharing its prefix."
        >
          <SectionsPage
            label="Settings"
            path="/the-guild/view/settings"
            items={ORGANIZATION_SETTINGS}
          />
        </CallSite>
        <CallSite
          source="pages/project-settings.tsx:523"
          origin="base"
          note="On /view/settings/composition."
        >
          <SectionsPage
            label="Settings"
            path="/the-guild/gateway/view/settings/composition"
            items={PROJECT_SETTINGS}
          />
        </CallSite>
      </CallSiteGroup>
    </div>
  ),
});

export const MembersSections = createPreview({
  label: 'Members sections',
  render: () => (
    <CallSite
      source="pages/organization-members.tsx:120"
      origin="base"
      note="On /view/members/roles. Roles and Invitations gated; the list is the bare URL and keeps its search filter, which is why Members is exact on the path only."
    >
      <SectionsPage
        label="Members"
        path="/the-guild/view/members/roles"
        items={[
          {
            label: 'Members',
            to: '/$organizationSlug/view/members',
            params: ORGANIZATION,
            exact: true,
          },
          {
            label: 'Roles',
            to: '/$organizationSlug/view/members/roles',
            params: ORGANIZATION,
          },
          {
            label: 'Groups',
            to: '/$organizationSlug/view/members/groups',
            params: ORGANIZATION,
          },
          {
            label: 'Invitations',
            to: '/$organizationSlug/view/members/invitations',
            params: ORGANIZATION,
          },
        ]}
      />
    </CallSite>
  ),
});
