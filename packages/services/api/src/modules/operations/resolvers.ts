import { hash, nsToMs, parseDateRangeInput } from '../../shared/helpers';
import { createConnection } from '../../shared/schema';
import { IdTranslator } from '../shared/providers/id-translator';
import { OperationsModule } from './__generated__/types';
import { OperationsManager } from './providers/operations-manager';

export const resolvers: OperationsModule.Resolvers = {
  Query: {
    async hasCollectedOperations(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(OperationsManager).hasCollectedOperations({
        organization,
        project,
        target,
      });
    },
    async fieldStats(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(OperationsManager).readFieldStats({
        organization,
        project,
        target,
        type: selector.type,
        field: selector.field,
        argument: selector.argument ?? undefined,
        period: parseDateRangeInput(selector.period),
      });
    },
    async fieldListStats(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(OperationsManager).readFieldListStats({
        organization,
        project,
        target,
        fields: selector.fields,
        period: parseDateRangeInput(selector.period),
      });
    },
    async schemaCoordinateStats(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return {
        period: parseDateRangeInput(selector.period),
        organization,
        project,
        target,
        schemaCoordinate: selector.schemaCoordinate,
      };
    },
    async clientStats(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return {
        period: parseDateRangeInput(selector.period),
        organization,
        project,
        target,
        clientName: selector.client,
      };
    },
    async operationsStats(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const operations = selector.operations ?? [];

      return {
        period: parseDateRangeInput(selector.period),
        organization,
        project,
        target,
        operations,
        clients:
          // TODO: figure out if the mapping should actually happen here :thinking:
          selector.clientNames?.map(clientName => (clientName === 'unknown' ? '' : clientName)) ??
          [],
      };
    },
    async clientStatsByTargets(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);

      const targets = selector.targetIds;
      const period = parseDateRangeInput(selector.period);

      const [rows, total] = await Promise.all([
        injector.get(OperationsManager).readUniqueClientNames({
          target: targets,
          project,
          organization,
          period,
        }),
        injector.get(OperationsManager).countRequests({
          organization,
          project,
          target: targets,
          period,
        }),
      ]);

      return rows.map(row => {
        return {
          name: row.name,
          count: row.count,
          percentage: total === 0 ? 0 : (row.count / total) * 100,
          versions: [], // TODO: include versions at some point
        };
      });
    },
  },
  SchemaCoordinateStats: {
    totalRequests({ organization, project, target, period, schemaCoordinate }, _, { injector }) {
      return injector.get(OperationsManager).countRequestsWithSchemaCoordinate({
        organization,
        project,
        target,
        period,
        schemaCoordinate,
      });
    },
    requestsOverTime(
      { organization, project, target, period, schemaCoordinate },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readRequestsOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        schemaCoordinate,
      });
    },
    async operations(
      { organization, project, target, period, schemaCoordinate },
      args,
      { injector },
    ) {
      const operationsManager = injector.get(OperationsManager);
      const [operations, durations] = await Promise.all([
        operationsManager.readOperationsStats({
          organization,
          project,
          target,
          period,
          schemaCoordinate,
        }),
        operationsManager.readDetailedDurationPercentiles({
          organization,
          project,
          target,
          period,
          schemaCoordinate,
        }),
      ]);

      return operations
        .map(op => {
          return {
            id: hash(`${op.operationName}__${op.operationHash}`),
            kind: op.kind,
            name: op.operationName,
            count: op.count,
            countOk: op.countOk,
            percentage: op.percentage,
            duration: durations.get(op.operationHash)!,
            operationHash: op.operationHash,
          };
        })
        .sort((a, b) => b.count - a.count);
    },
    clients({ organization, project, target, period, schemaCoordinate }, _, { injector }) {
      return injector.get(OperationsManager).readUniqueClients({
        target,
        project,
        organization,
        period,
        schemaCoordinate,
      });
    },
  },
  ClientStats: {
    totalRequests({ organization, project, target, period, clientName }, _, { injector }) {
      return injector.get(OperationsManager).countRequestsAndFailures({
        organization,
        project,
        target,
        period,
        clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
      });
    },
    totalVersions({ organization, project, target, period, clientName }, _, { injector }) {
      return injector.get(OperationsManager).countClientVersions({
        organization,
        project,
        target,
        period,
        clientName,
      });
    },
    requestsOverTime(
      { organization, project, target, period, clientName },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readRequestsOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
      });
    },
    async operations({ organization, project, target, period, clientName }, args, { injector }) {
      const operationsManager = injector.get(OperationsManager);
      const [operations, durations] = await Promise.all([
        operationsManager.readOperationsStats({
          organization,
          project,
          target,
          period,
          clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
        }),
        operationsManager.readDetailedDurationPercentiles({
          organization,
          project,
          target,
          period,
          clients: clientName === 'unknown' ? ['unknown', ''] : [clientName],
        }),
      ]);

      return operations
        .map(op => {
          return {
            id: hash(`${op.operationName}__${op.operationHash}`),
            kind: op.kind,
            name: op.operationName,
            count: op.count,
            countOk: op.countOk,
            percentage: op.percentage,
            duration: durations.get(op.operationHash)!,
            operationHash: op.operationHash,
          };
        })
        .sort((a, b) => b.count - a.count);
    },
    async versions({ organization, project, target, period, clientName }, { limit }, { injector }) {
      return injector.get(OperationsManager).readClientVersions({
        target,
        project,
        organization,
        period,
        clientName,
        limit,
      });
    },
  },
  OperationsStats: {
    async operations(
      { organization, project, target, period, operations: operationsFilter, clients },
      args,
      { injector },
    ) {
      const operationsManager = injector.get(OperationsManager);
      const [operations, durations] = await Promise.all([
        operationsManager.readOperationsStats({
          organization,
          project,
          target,
          period,
          operations: operationsFilter,
          clients,
        }),
        operationsManager.readDetailedDurationPercentiles({
          organization,
          project,
          target,
          period,
          operations: operationsFilter,
          clients,
        }),
      ]);

      return operations
        .map(op => {
          return {
            id: hash(`${op.operationName}__${op.operationHash}`),
            kind: op.kind,
            name: op.operationName,
            count: op.count,
            countOk: op.countOk,
            percentage: op.percentage,
            duration: durations.get(op.operationHash)!,
            operationHash: op.operationHash,
          };
        })
        .sort((a, b) => b.count - a.count);
    },
    totalRequests({ organization, project, target, period, operations, clients }, _, { injector }) {
      return injector.get(OperationsManager).countRequestsAndFailures({
        organization,
        project,
        target,
        period,
        operations,
        clients,
      });
    },
    totalFailures(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).countFailures({
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clients,
      });
    },
    totalOperations(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).countUniqueOperations({
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clients,
      });
    },
    requestsOverTime(
      { organization, project, target, period, operations: operationsFilter, clients },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readRequestsOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        operations: operationsFilter,
        clients,
      });
    },
    failuresOverTime(
      { organization, project, target, period, operations: operationsFilter, clients },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readFailuresOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        operations: operationsFilter,
        clients,
      });
    },
    durationOverTime(
      { organization, project, target, period, operations: operationsFilter, clients },
      { resolution },
      { injector },
    ) {
      return injector.get(OperationsManager).readDurationOverTime({
        target,
        project,
        organization,
        period,
        resolution,
        operations: operationsFilter,
        clients,
      });
    },
    clients(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).readUniqueClients({
        target,
        project,
        organization,
        period,
        operations: operationsFilter,
        clients,
      });
    },
    duration(
      { organization, project, target, period, operations: operationsFilter, clients },
      _,
      { injector },
    ) {
      return injector.get(OperationsManager).readGeneralDurationPercentiles({
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clients,
      });
    },
  },
  DurationValues: {
    p75(value) {
      return transformPercentile(value.p75);
    },
    p90(value) {
      return transformPercentile(value.p90);
    },
    p95(value) {
      return transformPercentile(value.p95);
    },
    p99(value) {
      return transformPercentile(value.p99);
    },
  },
  OperationStatsValuesConnection: createConnection(),
  ClientStatsValuesConnection: createConnection(),
  OrganizationGetStarted: {
    async reportingOperations(organization, _, { injector }) {
      if (organization.reportingOperations === true) {
        return organization.reportingOperations;
      }

      return injector.get(OperationsManager).hasOperationsForOrganization({
        organization: organization.id,
      });
    },
  },
  Project: {
    totalRequests(project, { period }, { injector }) {
      return injector.get(OperationsManager).countRequestsOfProject({
        project: project.id,
        organization: project.orgId,
        period: parseDateRangeInput(period),
      });
    },
    requestsOverTime(project, { resolution, period }, { injector }) {
      return injector.get(OperationsManager).readRequestsOverTimeOfProject({
        project: project.id,
        organization: project.orgId,
        period: parseDateRangeInput(period),
        resolution,
      });
    },
  },
  Target: {
    totalRequests(target, { period }, { injector }) {
      return injector.get(OperationsManager).countRequests({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
        period: parseDateRangeInput(period),
      });
    },
    async requestsOverTime(target, { resolution, period }, { injector }) {
      const result = await injector.get(OperationsManager).readRequestsOverTimeOfTargets({
        project: target.projectId,
        organization: target.orgId,
        targets: [target.id],
        period: parseDateRangeInput(period),
        resolution,
      });

      return result[target.id] ?? [];
    },
    operation(target, args, { injector }) {
      return injector.get(OperationsManager).getOperation({
        hash: args.hash,
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
  },
};

function transformPercentile(value: number | null): number {
  return value ? Math.round(nsToMs(value)) : 0;
}
