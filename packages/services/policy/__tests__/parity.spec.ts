import { schemaPolicyApiRouter } from '../src/api';
import { composedSchema, subgraphSdl } from './fixtures/schemas';
import { storedPolicies } from './fixtures/stored-policies';

const caller = schemaPolicyApiRouter.createCaller({ req: { log: { info() {} } } as any });

type LintMessage = Awaited<ReturnType<typeof caller.checkPolicy>>[number];

// Only the fields the API persists (toSchemaCheckWarning in registry-checks.ts) are part of the contract.
function format(messages: LintMessage[]) {
  return messages.map(
    m => `${m.severity} ${m.ruleId} ${m.line}:${m.column}-${m.endLine}:${m.endColumn} ${m.message}`,
  );
}

/**
 * Snapshots the lint output of every stored policy shape, so a change to the lint engine
 * has to reproduce today's results exactly or show up as a snapshot diff.
 */
describe('stored policy parity', () => {
  it.each(storedPolicies.map((policy, index) => [index, policy] as const))(
    'policy #%i',
    async (_, policy) => {
      const composed = await caller.checkPolicy({
        target: '1',
        source: composedSchema,
        schema: composedSchema,
        policy,
      });
      const subgraph = await caller.checkPolicy({
        target: '1',
        source: subgraphSdl,
        schema: composedSchema,
        policy,
      });

      expect({ composed: format(composed), subgraph: format(subgraph) }).toMatchSnapshot();
    },
  );
});
