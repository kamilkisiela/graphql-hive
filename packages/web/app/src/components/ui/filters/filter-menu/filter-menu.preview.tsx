import { useEffect, useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { FilterChips, FilterMenu } from './filter-menu';
import type { FilterDimension, FilterItem, FilterSelection } from './types';
import * as styles from './filter-menu.preview.css';

export const nav: NavPath = 'Components/Filters/FilterMenu';

const CLIENTS: FilterItem[] = [
  { name: 'Hive CLI', values: ['0.12.0', '0.12.1', '0.12.2', '0.12.3'] },
  { name: 'hive-gateway', values: ['0.1.0', '0.2.0', '1.0.0'] },
  { name: 'graphql-yoga', values: ['5.0.0', '5.1.0'] },
];

const TARGETS: FilterItem[] = [
  { name: 'production', values: [] },
  { name: 'staging', values: [] },
  { name: 'development', values: [] },
];

const SEVERITIES: FilterItem[] = [
  { name: 'Breaking', values: [] },
  { name: 'Dangerous', values: [] },
  { name: 'Safe', values: [] },
];

/**
 * Holds one selection array per dimension, which is what the real call sites do
 * (they keep it in URL state instead).
 */
function useDimensions(initial: Record<string, FilterSelection[]> = {}) {
  const [clients, setClients] = useState<FilterSelection[]>(initial.clients ?? []);
  const [targets, setTargets] = useState<FilterSelection[]>(initial.targets ?? []);
  const [severities, setSeverities] = useState<FilterSelection[]>(initial.severities ?? []);

  const dimensions: FilterDimension[] = [
    {
      key: 'client',
      label: 'Client',
      items: CLIENTS,
      selectedItems: clients,
      onChange: setClients,
      valuesLabel: 'versions',
    },
    {
      key: 'target',
      label: 'Target',
      items: TARGETS,
      selectedItems: targets,
      onChange: setTargets,
    },
    {
      key: 'severity',
      label: 'Severity',
      labelPlural: 'severities',
      items: SEVERITIES,
      selectedItems: severities,
      onChange: setSeverities,
    },
  ];

  return dimensions;
}

export const Default = createPreview(() => {
  const dimensions = useDimensions();
  return <FilterMenu dimensions={dimensions} />;
});

/** The usual pairing: the menu adds filters, chips edit and remove them. */
export const WithChips = createPreview(() => {
  const dimensions = useDimensions({
    clients: [{ name: 'Hive CLI', values: ['0.12.1'] }],
    targets: [{ name: 'production', values: null }],
  });

  return (
    <div className={styles.div}>
      <FilterMenu dimensions={dimensions} />
      <FilterChips dimensions={dimensions} />
    </div>
  );
});

/** `activeLabel` and `onClearActive` are a matched pair: the trigger only morphs with both. */
export const ActiveView = createPreview(() => {
  const dimensions = useDimensions({
    clients: [{ name: 'hive-gateway', values: null }],
  });

  return (
    <FilterMenu dimensions={dimensions} activeLabel="Gateway errors" onClearActive={() => {}} />
  );
});

// A real federated supergraph has hundreds of types, so the list is long enough
// to need both the search box and the virtualizer.
const TYPES: FilterItem[] = [
  'Query',
  'Mutation',
  'Subscription',
  'Account',
  'AccountConnection',
  'Address',
  'Cart',
  'CartItem',
  'Category',
  'Checkout',
  'Currency',
  'Customer',
  'Discount',
  'Inventory',
  'InventoryItem',
  'Money',
  'Order',
  'OrderLineItem',
  'PageInfo',
  'Payment',
  'Product',
  'ProductVariant',
  'Review',
  'ReviewConnection',
  'Shipment',
  'ShippingRate',
  'User',
  'UserProfile',
  'Warehouse',
  'Wishlist',
].map(name => ({ name, values: [] }));

/**
 * The three non-item kinds together, as the schema explorer uses them: a
 * single-select dimension addressing a route param, a free-text dimension, and
 * a toggle. Toggles group into their own section below the divider and never
 * produce a chip.
 */
export const AllDimensionKinds = createPreview(() => {
  const [type, setType] = useState<FilterSelection[]>([{ name: 'Product', values: null }]);
  const [field, setField] = useState('price');
  const [descriptions, setDescriptions] = useState(false);
  const [targets, setTargets] = useState<FilterSelection[]>([]);

  const dimensions: FilterDimension[] = [
    {
      key: 'type',
      label: 'Type',
      items: TYPES,
      selectedItems: type,
      onChange: setType,
      singleSelect: true,
      alwaysShowSearch: true,
    },
    {
      key: 'field',
      label: 'Field',
      kind: 'text',
      value: field,
      onChange: setField,
      placeholder: 'Find field',
    },
    {
      key: 'target',
      label: 'Target',
      items: TARGETS,
      selectedItems: targets,
      onChange: setTargets,
    },
    {
      key: 'descriptions',
      label: 'Show descriptions',
      kind: 'toggle',
      checked: descriptions,
      onChange: setDescriptions,
    },
  ];

  return (
    <div className={styles.div2}>
      <FilterMenu dimensions={dimensions} />
      <FilterChips dimensions={dimensions} />
    </div>
  );
});

const INSIGHTS_OPERATIONS: FilterItem[] = [
  'GetOrganizationMembersWithPermissions',
  'ListSchemaVersionsForTargetOverview',
  'CreateAccessTokenForOrganization',
  'UpdateProjectRegistryModelSettings',
  'GetSchemaCheckWithBreakingChanges',
  'FetchUsageStatisticsForClientVersion',
  'DeleteTargetConditionalBreakingChangeConfig',
  'ListOrganizationInvitationsPaginated',
  'CompareSchemaVersionsWithContracts',
  'PublishSubgraphSchemaWithMetadata',
  'GetLaboratoryPreflightScriptHistory',
  'IntrospectSupergraphFromCdn',
  'ListAlertChannelsForProject',
  'GetBillingUsageAndLimitsForOrg',
  'me',
  'ping',
].map((name, i) => ({ id: `hash-${i}`, name, values: [] }));

const INSIGHTS_CLIENTS: FilterItem[] = [
  { name: 'unknown', values: [] },
  { name: 'Hive CLI', values: ['0.50.1', '0.50.0', '0.49.0', '0.48.3'] },
  { name: 'Hive Client', values: ['0.5.0', '0.23.1', '0.14.2', '0.10.0', '0.8.2'] },
  { name: 'hive-gateway', values: ['1.13.0', '1.12.0', '1.11.4'] },
  { name: 'hive-console-frontend', values: ['0.0.1'] },
  { name: 'hive-schema-registry-worker', values: ['2.4.0', '2.3.0'] },
  { name: 'graphql-yoga', values: ['5.10.0', '5.9.0'] },
  { name: 'hive-apollo-router-plugin', values: ['1.2.0', '1.1.0', '1.0.0'] },
  { name: 'octokit-graphql', values: ['8.1.1', '8.0.0'] },
  { name: 'graphql-mesh-serve-runtime', values: ['1.5.0'] },
  { name: 'apollo-client', values: ['3.11.0', '3.10.0'] },
  { name: 'urql', values: ['4.1.0', '4.0.0'] },
  { name: 'relay-runtime', values: ['17.0.0'] },
  { name: 'hive-cdn-edge-worker', values: ['0.9.0', '0.8.0'] },
  { name: 'graphql-codegen-hive-plugin', values: ['2.0.0'] },
  { name: 'k6-load-test', values: ['0.52.0'] },
];

/**
 * The Insights page: operations and clients, both long enough to scroll and
 * search, with names longer than a short list would size the popup to.
 */
export const InsightsDimensions = createPreview(() => {
  const [operations, setOperations] = useState<FilterSelection[]>([]);
  const [clients, setClients] = useState<FilterSelection[]>([]);

  const dimensions: FilterDimension[] = [
    {
      key: 'operation',
      label: 'Operation',
      items: INSIGHTS_OPERATIONS,
      selectedItems: operations,
      onChange: setOperations,
    },
    {
      key: 'client',
      label: 'Client',
      items: INSIGHTS_CLIENTS,
      selectedItems: clients,
      onChange: setClients,
      valuesLabel: 'versions',
    },
  ];

  return (
    <div className={styles.div3}>
      <FilterMenu dimensions={dimensions} />
      <FilterChips dimensions={dimensions} />
    </div>
  );
});

/**
 * Insights on a slow connection: the picker query resolves after the page is
 * interactive, so the submenu can be open on an empty list when the items land.
 * Open Filter → Client within the first few seconds to see it.
 */
export const InsightsDimensionsLoading = createPreview(() => {
  const [loaded, setLoaded] = useState(false);
  const [clients, setClients] = useState<FilterSelection[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const dimensions: FilterDimension[] = [
    {
      key: 'client',
      label: 'Client',
      items: loaded ? INSIGHTS_CLIENTS : [],
      selectedItems: clients,
      onChange: setClients,
      valuesLabel: 'versions',
    },
  ];

  return (
    <div className={styles.div4}>
      <FilterMenu dimensions={dimensions} />
      <FilterChips dimensions={dimensions} />
      <span className={styles.span}>{loaded ? 'items loaded' : 'loading items…'}</span>
    </div>
  );
});

/** Empty text value renders no chip, and the toggle section still gets its divider. */
export const TextFilterEmpty = createPreview(() => {
  const [field, setField] = useState('');
  const [descriptions, setDescriptions] = useState(true);

  const dimensions: FilterDimension[] = [
    {
      key: 'field',
      label: 'Field',
      kind: 'text',
      value: field,
      onChange: setField,
      placeholder: 'Find field',
    },
    {
      key: 'descriptions',
      label: 'Show descriptions',
      kind: 'toggle',
      checked: descriptions,
      onChange: setDescriptions,
    },
  ];

  return (
    <div className={styles.div5}>
      <FilterMenu dimensions={dimensions} />
      <FilterChips dimensions={dimensions} />
    </div>
  );
});
