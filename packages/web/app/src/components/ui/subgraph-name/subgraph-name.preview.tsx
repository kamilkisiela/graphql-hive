import { createPreview, type NavPath } from 'react-foundry';
import { CompositionErrorMessage } from '@/components/target/history/composition-error-message';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { SubgraphName } from './subgraph-name';
import * as styles from './subgraph-name.preview.css';

export const nav: NavPath = 'Components/SubgraphName';

/**
 * One way to write a subgraph's name wherever the UI mentions one. Today the explorer hashes a
 * random hue per subgraph and the history list puts an icon beside mono text; both are candidates
 * to move onto this once it settles, which retires the colour generator.
 */

const NAMES = [
  'users',
  'billing',
  'invoicing',
  'balance-service',
  'partner-api-for-the-european-reseller-network',
];

export const Default = createPreview(() => (
  <div className={styles.div}>
    {NAMES.map(name => (
      <SubgraphName key={name} name={name} />
    ))}
  </div>
));

/** Beside the warning badge that marks a schema coordinate, which is the company it keeps. */
export const InProse = createPreview(() => (
  <p className={styles.p}>
    from subgraph <SubgraphName name="billing" />: cannot move to subgraph{' '}
    <SubgraphName name="invoicing" /> using{' '}
    <Badge content='@key(fields: "id")' variants={{ variant: 'warning', padding: 'tight' }} /> of{' '}
    <Badge content="User" variants={{ variant: 'warning', padding: 'tight' }} />, the key field(s)
    cannot be resolved from subgraph <SubgraphName name="billing" />.
  </p>
));

const SATISFIABILITY = `The following supergraph API query:
{
  node(id: "<any id>") {
    ... on User {
      invoices(filter: {}) {
        total
      }
    }
  }
}
cannot be satisfied by the subgraphs because:
- from subgraph "users": cannot find field "User.invoices".
- from subgraph "billing":
  - field "User.invoices" is not resolvable because it is overridden by subgraph "invoicing".
  - cannot move to subgraph "invoicing" using @key(fields: "id") of "User", the key field(s) cannot be resolved from subgraph "billing" (please ensure that this is not due to key field "id" being accidentally marked @external).`;

const RULES = [
  'Type of field "User.id" is incompatible across subgraphs: it has type "ID!" in subgraph "users" but type "String!" in subgraph "billing"',
  '[billing] Type "User" is an extension type, but there is no type definition for "User" in any subgraph.',
  'Field "User.email" is marked @external on all the subgraphs in which it is listed (subgraphs "users" and "billing").',
  '[orders] Product.sku -> is marked as @external but is not used by a @requires, @key, or @provides directive.',
];

/** The real composition error renderer, which finds subgraph names in both spellings the composers use. */
export const InCompositionErrors = createPreview(() => (
  <ul className={styles.ul}>
    {[SATISFIABILITY, ...RULES].map((message, index) => (
      <li key={index} className={styles.li}>
        <CompositionErrorMessage message={message} />
      </li>
    ))}
  </ul>
));

/** A long name in a narrow spot truncates with the full name on hover. */
export const Truncation = createPreview(() => (
  <div className={styles.div2}>
    <SubgraphName name="partner-api-for-the-european-reseller-network" />
  </div>
));
