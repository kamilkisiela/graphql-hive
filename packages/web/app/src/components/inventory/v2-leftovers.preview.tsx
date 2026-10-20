import { useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { Combobox } from '@/components/ui/combobox';
import { Markdown } from '@/components/ui/markdown';
import { CallSite, InventoryList } from './shared';
import * as styles from './v2-leftovers.preview.css';

export const nav: NavPath = 'Inventory/V2Leftovers';

/**
 * The `v2/` primitives with no `ui/` counterpart that are still to migrate: Combobox and
 * Markdown.
 *
 * Unlike the rest of Phase 0 there is nothing to compare against here — no second version exists,
 * so these are transcriptions of the only thing that ships.
 */

const ENTRIES = [
  {
    source: 'pages/target-settings.tsx:356, :429, multiselect-config.tsx:42',
    origin: 'v2',
    what: 'Combobox — 3 sites, all multi-select tag pickers, built on react-select',
    coveredBy: 'Combobox',
  },
  {
    source:
      'explorer/common.tsx:26, :277, scalar-type.tsx, policy-list-item.tsx:75, rules-configuration/index.tsx',
    origin: 'v2',
    what: 'Markdown — 5 sites rendering schema descriptions through snarkdown + dompurify',
    coveredBy: 'Markdown',
  },
] as const;

export const Inventory = createPreview({
  label: 'Inventory',
  render: () => (
    <InventoryList
      component="v2 combobox, markdown"
      summary={
        <>
          <strong>Two components left here, 8 render sites, no ui/ counterparts.</strong> Each is
          the only implementation of its kind in the app, so unlike the rest of Phase 0 there is
          nothing to compare against — these are transcriptions of the only thing that ships.
          <br />
          <br />
          <strong>Combobox drags in react-select.</strong> Three call sites, all multi-select tag
          pickers over the same shape. With <code>v2/autocomplete</code> deleted it is the last
          consumer of that dependency.
        </>
      }
      entries={ENTRIES}
    />
  ),
});

// ---------------------------------------------------------------------------
// v2/combobox — the last react-select consumer.
// ---------------------------------------------------------------------------

export const ComboboxPreview = createPreview({
  label: 'Combobox',
  render: () => <ComboboxExample />,
});

function ComboboxExample() {
  const [value, setValue] = useState([{ label: 'web-app', value: 'web-app' }]);

  return (
    <div className={styles.comboboxExampleDiv}>
      <CallSite
        source="pages/target-settings.tsx:356, :429"
        origin="v2"
        note="Two identical multi-select tag pickers - client names and app deployment names - both mapping a string[] to { label, value } pairs on the way in and back on the way out. Type to filter, click an x to remove."
      >
        <div className={styles.comboboxExampleDiv2}>
          <Combobox
            name="clientNames"
            placeholder="Select..."
            value={value}
            options={[
              { label: 'web-app', value: 'web-app' },
              { label: 'ios-app', value: 'ios-app' },
              { label: 'android-app', value: 'android-app' },
              { label: 'internal-tooling', value: 'internal-tooling' },
            ]}
            onChange={next => setValue([...next])}
            onBlur={() => {}}
          />
        </div>
      </CallSite>

      <CallSite
        source="components/policy/rules-configuration/multiselect-config.tsx:42"
        origin="v2"
        note="The third site, w-full inside a policy rule row. Same shape again: three call sites, one pattern, and react-select carried for all of it. With v2/autocomplete deleted, this is the dependency's last consumer."
      >
        <div className={styles.comboboxExampleDiv3}>
          <Combobox
            name="options"
            placeholder="Select Options"
            className={styles.comboboxExampleCombobox}
            options={[
              { label: 'camelCase', value: 'camelCase' },
              { label: 'PascalCase', value: 'PascalCase' },
              { label: 'snake_case', value: 'snake_case' },
            ]}
            onChange={() => {}}
            onBlur={() => {}}
          />
        </div>
      </CallSite>
    </div>
  );
}

// ---------------------------------------------------------------------------
// v2/markdown — schema descriptions, sanitised.
// ---------------------------------------------------------------------------

export const MarkdownPreview = createPreview({
  label: 'Markdown',
  render: () => (
    <div className={styles.div}>
      <CallSite
        source="components/target/explorer/common.tsx:26"
        origin="v2"
        note="Renders a GraphQL schema description. snarkdown converts, dompurify sanitises, and the result goes in through dangerouslySetInnerHTML - the sanitiser is the only thing between a schema description and script injection, so it is load-bearing rather than decorative. Styling comes from a global .hive-markdown class in index.css, not from the component."
      >
        <div className={styles.div2}>
          <Markdown
            className={styles.markdown}
            content={
              'The `products` connection returns a paginated list.\n\nSee the [pagination guide](https://example.com) for cursor semantics. Supports **forward** and *backward* paging.'
            }
          />
        </div>
      </CallSite>

      <CallSite
        source="components/target/explorer/common.tsx:277"
        origin="v2"
        note="The same component inside a tooltip, rendering a deprecation reason. Markdown in a tooltip is the case most likely to overflow, since the content is author-supplied."
      >
        <div className={styles.div3}>
          <Markdown
            className={styles.markdown2}
            content="Use `productsConnection` instead. This field will be removed in **v3**."
          />
        </div>
      </CallSite>

      <CallSite
        source="components/policy/policy-list-item.tsx:75"
        origin="v2"
        note="A policy rule description at text-sm, followed by a DocsLink. Five sites in total and four of the five pass a className, all of them adjusting colour or size."
      >
        <div className={styles.div4}>
          <Markdown
            content="Requires all types and fields to have a description. Set `ignoreTypes` to skip specific types."
            className={styles.markdown3}
          />
        </div>
      </CallSite>
    </div>
  ),
});
