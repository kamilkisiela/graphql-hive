import { Injectable, Scope } from 'graphql-modules';
import { ClickHouse, sql } from '../../operations/providers/clickhouse-client';
import { Logger } from '../../shared/providers/logger';
import { AuditLogEvent, auditLogSchema } from './audit-logs-types';

// TODO: Error: No provider for ClickHouse! (AuditLogManager -> ClickHouse) - in Module "audit-logs" (Operation Scope)
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AuditLogManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private clickHouse: ClickHouse,
  ) {
    this.logger = logger.child({ source: 'AuditLogsManager' });
  }

  async createLogAuditEvent(event: AuditLogEvent): Promise<void> {
    const { eventTime, eventType, id, organizationId, user } = event;
    this.logger.info('Creating a log audit event (event=%o)', event);
    const parsedEvent = auditLogSchema.parse(event);

    const query = sql`
      INSERT INTO audit_log (id, event_time, user_id, user_email, organization_id, event_action, metadata)
      FORMAT CSV
    `;

    const values = [
      id,
      eventTime,
      user.userId,
      user.userEmail,
      organizationId,
      eventType,
      JSON.stringify(parsedEvent),
    ];

    const result = await this.clickHouse.insert({
      data: [values],
      query,
      queryId: 'audit-log-create',
      timeout: 5000,
    });
    return result;
  }

  async getPaginatedAuditLogs(limit: string, offset: string): Promise<AuditLogEvent[]> {
    this.logger.info('Getting paginated audit logs (limit=%s, offset=%s)', limit, offset);

    const query = sql`
      SELECT *
      FROM audit_log
      ORDER BY event_time DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result = await this.clickHouse.query({
      query,
      queryId: 'get-audit-logs',
      timeout: 5000,
    });
    if (!result || !result.data || result.data.length === 0) {
      throw new Error('Audit logs not found');
    }
    return result.data as AuditLogEvent[];
  }

  async getAuditLogsCount(): Promise<number> {
    this.logger.info('Getting audit logs count');
    const query = sql`
      SELECT COUNT(*)
      FROM audit_log
    `;

    const result = await this.clickHouse.query({
      query,
      queryId: 'get-audit-logs-count',
      timeout: 5000,
    });
    return result.data.length;
  }
}
