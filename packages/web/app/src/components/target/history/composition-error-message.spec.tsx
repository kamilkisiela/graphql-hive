// @vitest-environment jsdom
import * as badgeStyles from '@/components/ui/primitives/badge/badge.css';
import { render } from '@testing-library/react';
import {
  CompositionErrorMessage,
  layoutProseLine,
  splitCompositionErrorMessage,
} from './composition-error-message';

const QUERY =
  '{\n  custodianAccount(id: "<any id>") {\n    balances {\n      positionDirection\n    }\n  }\n}';
const REASONS =
  'cannot be satisfied by the subgraphs because:\n- from subgraph "balance-service": cannot find field "Balance.positionDirection".';

describe('splitCompositionErrorMessage', () => {
  it('lifts the printed query out of a satisfiability error', () => {
    expect(
      splitCompositionErrorMessage(`The following supergraph API query:\n${QUERY}\n${REASONS}`),
    ).toEqual([
      { kind: 'prose', text: 'The following supergraph API query:' },
      { kind: 'code', text: QUERY },
      { kind: 'prose', text: REASONS },
    ]);
  });

  it('leaves any other message as one prose segment, newlines included', () => {
    const message = '[billing] User -> invalid @key. Available keys:\n\t@key(fields: "id")';
    expect(splitCompositionErrorMessage(message)).toEqual([{ kind: 'prose', text: message }]);
  });

  it('splits every nested query in the Apollo mutation wrapper and dedents it', () => {
    const inner = (field: string) =>
      [
        '  The following supergraph API query:',
        '  mutation {',
        '    updateUser {',
        `      ${field}`,
        '    }',
        '  }',
        '  cannot be satisfied by the subgraphs because:',
        `  - from subgraph "users": cannot find field "User.${field}".`,
      ].join('\n');
    const message = `Please fix one of:\n- From subgraph "users":\n${inner('email')}\n- From subgraph "billing":\n${inner('name')}`;
    expect(splitCompositionErrorMessage(message)).toEqual([
      {
        kind: 'prose',
        text: 'Please fix one of:\n- From subgraph "users":\n  The following supergraph API query:',
      },
      { kind: 'code', text: 'mutation {\n  updateUser {\n    email\n  }\n}' },
      {
        kind: 'prose',
        text: '  cannot be satisfied by the subgraphs because:\n  - from subgraph "users": cannot find field "User.email".\n- From subgraph "billing":\n  The following supergraph API query:',
      },
      { kind: 'code', text: 'mutation {\n  updateUser {\n    name\n  }\n}' },
      {
        kind: 'prose',
        text: '  cannot be satisfied by the subgraphs because:\n  - from subgraph "users": cannot find field "User.name".',
      },
    ]);
  });

  it('does not split when the closing sentence is missing', () => {
    const message = 'The following supergraph API query:\n{\n  user\n}';
    expect(splitCompositionErrorMessage(message)).toEqual([{ kind: 'prose', text: message }]);
  });
});

describe('layoutProseLine', () => {
  it('turns two spaces or a tab into one level and lifts a leading dash out as the bullet', () => {
    expect(layoutProseLine('- from subgraph "users":')).toEqual({
      depth: 0,
      bullet: true,
      text: 'from subgraph "users":',
    });
    expect(layoutProseLine('  - cannot find field "User.orders".')).toEqual({
      depth: 1,
      bullet: true,
      text: 'cannot find field "User.orders".',
    });
    expect(layoutProseLine('\t@key(fields: "id")')).toEqual({
      depth: 1,
      bullet: false,
      text: '@key(fields: "id")',
    });
  });
});

// The field badges are the warning variant; the class is the first of its composed names.
const warningBadge = badgeStyles.badgeVariants.classNames.variants.variant.warning.split(' ')[0];

describe('CompositionErrorMessage', () => {
  const rendered = (message: string) => {
    const { container } = render(<CompositionErrorMessage message={message} />);
    return {
      container,
      badges: [...container.querySelectorAll(`.${warningBadge}`)].map(el => el.textContent),
      subgraphs: [...container.querySelectorAll('[title]')].map(el => el.getAttribute('title')),
    };
  };

  it('renders the query as one chip-free code block, the subgraph as SubgraphName, the field as a badge', () => {
    const { container, badges, subgraphs } = rendered(
      `The following supergraph API query:\n${QUERY}\n${REASONS}`,
    );
    const blocks = container.querySelectorAll('pre');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].textContent).toBe(QUERY);
    expect(blocks[0].querySelectorAll('*')).toHaveLength(0);
    expect(subgraphs).toEqual(['balance-service']);
    expect(badges).toEqual(['Balance.positionDirection']);
  });

  it('treats a leading [name] like a quoted subgraph, and leaves other brackets alone', () => {
    expect(rendered('[products] Type "User" is an extension type.')).toMatchObject({
      subgraphs: ['products'],
      badges: ['User'],
    });
    expect(
      rendered('[@tag] -> Custom directives must be implemented in every service.'),
    ).toMatchObject({
      subgraphs: ['@tag'],
      badges: [],
    });
    expect(rendered('Invalid value of type "[String!]!" for [users, billing].')).toMatchObject({
      subgraphs: [],
      badges: ['[String!]!'],
    });
  });

  it('finds subgraph names after the word subgraph, singular or listed', () => {
    expect(
      rendered(
        'Type of field "User.id" is incompatible across subgraphs: it has type "ID!" in subgraph "users" but type "String!" in subgraph "billing"',
      ),
    ).toMatchObject({ subgraphs: ['users', 'billing'], badges: ['User.id', 'ID!', 'String!'] });
    expect(
      rendered(
        'Field "User.email" is marked @external on all the subgraphs in which it is listed (subgraphs "users" and "billing").',
      ),
    ).toMatchObject({ subgraphs: ['users', 'billing'], badges: ['User.email', '@external'] });
  });
});
