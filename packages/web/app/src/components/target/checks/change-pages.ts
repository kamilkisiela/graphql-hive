import { useClient } from 'urql';
import { graphql } from '@/gql';
import type { SchemaChangeKind } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';

const BreakingChangesPageQuery = graphql(`
  query CheckBreakingChangesPageQuery(
    $selector: TargetSelectorInput!
    $schemaCheckId: ID!
    $offset: Int!
  ) {
    target(reference: { bySelector: $selector }) {
      id
      schemaCheck(id: $schemaCheckId) {
        id
        breakingSchemaChanges(first: 300, offset: $offset) {
          edges {
            node {
              ...ChangesBlock_SchemaChangeWithUsageFragment
            }
          }
        }
      }
    }
  }
`);

const ContractBreakingChangesPageQuery = graphql(`
  query CheckContractBreakingChangesPageQuery(
    $selector: TargetSelectorInput!
    $schemaCheckId: ID!
    $contractCheckId: ID!
    $offset: Int!
  ) {
    target(reference: { bySelector: $selector }) {
      id
      schemaCheck(id: $schemaCheckId) {
        id
        contractCheck(id: $contractCheckId) {
          id
          breakingSchemaChanges(first: 300, offset: $offset) {
            edges {
              node {
                ...ChangesBlock_SchemaChangeWithUsageFragment
              }
            }
          }
        }
      }
    }
  }
`);

const SafeChangesPageQuery = graphql(`
  query CheckSafeChangesPageQuery(
    $selector: TargetSelectorInput!
    $schemaCheckId: ID!
    $kind: SchemaChangeKind!
    $offset: Int!
  ) {
    target(reference: { bySelector: $selector }) {
      id
      schemaCheck(id: $schemaCheckId) {
        id
        safeSchemaChangeGroups(kind: $kind) {
          kind
          changes(first: 300, offset: $offset) {
            edges {
              node {
                ...ChangesBlock_SchemaChangeFragment
              }
            }
          }
        }
      }
    }
  }
`);

const ContractSafeChangesPageQuery = graphql(`
  query CheckContractSafeChangesPageQuery(
    $selector: TargetSelectorInput!
    $schemaCheckId: ID!
    $contractCheckId: ID!
    $kind: SchemaChangeKind!
    $offset: Int!
  ) {
    target(reference: { bySelector: $selector }) {
      id
      schemaCheck(id: $schemaCheckId) {
        id
        contractCheck(id: $contractCheckId) {
          id
          safeSchemaChangeGroups(kind: $kind) {
            kind
            changes(first: 300, offset: $offset) {
              edges {
                node {
                  ...ChangesBlock_SchemaChangeFragment
                }
              }
            }
          }
        }
      }
    }
  }
`);

function rowsOf<T>(connection: { edges: ReadonlyArray<{ node: T }> } | null | undefined) {
  return connection?.edges.map(edge => edge.node) ?? [];
}

/**
 * Loads the pages after the first of a check's breaking changes and of each safe-change group, for
 * the default graph or, given its id, one contract. A request that fails rejects, so the list can
 * say so and keep the page it has.
 */
export function useChangePageLoaders(args: { schemaCheckId: string; contractCheckId?: string }) {
  const client = useClient();
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const base = {
    selector: { organizationSlug, projectSlug, targetSlug },
    schemaCheckId: args.schemaCheckId,
  };
  const { contractCheckId } = args;

  async function loadBreakingPage(offset: number) {
    if (contractCheckId) {
      const result = await client
        .query(ContractBreakingChangesPageQuery, { ...base, contractCheckId, offset })
        .toPromise();
      if (result.error) {
        throw result.error;
      }
      return rowsOf(result.data?.target?.schemaCheck?.contractCheck?.breakingSchemaChanges);
    }
    const result = await client.query(BreakingChangesPageQuery, { ...base, offset }).toPromise();
    if (result.error) {
      throw result.error;
    }
    return rowsOf(result.data?.target?.schemaCheck?.breakingSchemaChanges);
  }

  async function loadSafePage(kind: SchemaChangeKind, offset: number) {
    if (contractCheckId) {
      const result = await client
        .query(ContractSafeChangesPageQuery, { ...base, contractCheckId, kind, offset })
        .toPromise();
      if (result.error) {
        throw result.error;
      }
      return rowsOf(
        result.data?.target?.schemaCheck?.contractCheck?.safeSchemaChangeGroups[0]?.changes,
      );
    }
    const result = await client.query(SafeChangesPageQuery, { ...base, kind, offset }).toPromise();
    if (result.error) {
      throw result.error;
    }
    return rowsOf(result.data?.target?.schemaCheck?.safeSchemaChangeGroups[0]?.changes);
  }

  return { loadBreakingPage, loadSafePage };
}
