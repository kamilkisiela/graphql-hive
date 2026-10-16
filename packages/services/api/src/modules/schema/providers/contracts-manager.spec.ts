import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import type { SchemaCheck } from '@hive/storage';
import { ContractsManager } from './contracts-manager';

const check = (id: string) =>
  ({ id, conditionalBreakingChangeMetadata: null }) as unknown as SchemaCheck;

function manager() {
  const load = vi.fn(async (args: { schemaCheckId: string }) => ({
    edges: [{ node: { id: `contract-check-of-${args.schemaCheckId}` }, cursor: '' }],
    pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: '', endCursor: '' },
  }));
  const logger = { child: () => logger };
  const contracts = { getPaginatedContractChecksBySchemaCheckId: load };
  const contractsManager = new ContractsManager(
    logger as any,
    contracts as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { contractsManager, load };
}

describe('ContractsManager.getContractsChecksForSchemaCheck', () => {
  test("loads a schema check's contract checks once per operation", async () => {
    const { contractsManager, load } = manager();

    const first = contractsManager.getContractsChecksForSchemaCheck(check('check-1'));
    const again = contractsManager.getContractsChecksForSchemaCheck(check('check-1'));

    await expect(again).resolves.toBe(await first);
    expect(load).toHaveBeenCalledTimes(1);

    await contractsManager.getContractsChecksForSchemaCheck(check('check-2'));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
