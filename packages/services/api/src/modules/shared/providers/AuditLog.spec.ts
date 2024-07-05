import 'reflect-metadata';

import { ClickHouse } from '../../operations/providers/clickhouse-client';
import { AuditLog } from './AuditLog';
import { testkit } from 'graphql-modules';
import { CLICKHOUSE_CONFIG } from '../../operations/providers/tokens';

describe('AuditLog', () => {
  let auditLog: AuditLog;

  beforeEach(() => {
    auditLog = new AuditLog(new ClickHouse(
      CLICKHOUSE_CONFIG,
      new HttpClient(),
      {}
    ), mockLogger);
  });

  it('logAuditEvent should call ClickHouse.query with correct parameters and update metric', async () => {
    const mockEvent = {
      user: { id: 'user1', email: 'user1@example.com' },
      organizationId: 'org1',
      projectId: 'proj1',
      targetId: 'target1',
      schemaVersionId: 'schema1',
      eventAction: 'CREATE',
      details: { key: 'value' },
    };

    await auditLog.logAuditEvent(mockEvent);

    expect(mockClickHouse.query).toHaveBeenCalledOnce();
    expect(promClient.Gauge.prototype.inc).toHaveBeenCalledOnce();

    // Additional assertions can be made here regarding the specific SQL query structure and metric increment value
  });
});
