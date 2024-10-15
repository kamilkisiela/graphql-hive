import { Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { QueryAuditLogsArgs } from '../../../__generated__/types.next';
import { User } from '../../../shared/entities';
import { ClickHouse, sql } from '../../operations/providers/clickhouse-client';
import { SqlValue } from '../../operations/providers/sql';
import { Logger } from '../../shared/providers/logger';
import { formatToClickhouseDateTime } from '../helpers';
import { AuditLogEvent, auditLogSchema } from './audit-logs-types';

export const AUDIT_LOG_CLICKHOUSE_OBJECT = z.object({
  id: z.string(),
  event_time: z.string(),
  user_id: z.string(),
  user_email: z.string(),
  organization_id: z.string(),
  event_action: z.string(),
  metadata: z.string().transform(x => JSON.parse(x)),
});

export type AuditLogModel = z.infer<typeof AUDIT_LOG_CLICKHOUSE_OBJECT>;

const AUDIT_LOG_CLICKHOUSE_ARRAY = z.array(AUDIT_LOG_CLICKHOUSE_OBJECT);

type AuditLogRecordEvent = {
  userId: string;
  userEmail: string;
  organizationId: string;
  user: (User & { isAdmin: boolean }) | null;
};

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
    this.logger = logger.child({ source: 'AuditLogManager' });
  }

  createLogAuditEvent(event: AuditLogEvent, record: AuditLogRecordEvent): void {
    void this.internalCreateLogAuditEvent(event, record);
  }

  private async internalCreateLogAuditEvent(
    event: AuditLogEvent,
    record: AuditLogRecordEvent,
  ): Promise<void> {
    try {
      const { eventType } = event;
      const { organizationId, userEmail, userId } = record;
      this.logger.debug('Creating a log audit event (event=%o)', event);

      const parsedEvent = auditLogSchema.parse(event);
      const metadata = {
        user: record.user,
        ...parsedEvent,
      };

      const eventMetadata = JSON.stringify(metadata);
      const eventTime = new Date();

      const values = [eventTime, userId, userEmail, organizationId, eventType, eventMetadata];

      await this.clickHouse.insert({
        query: sql`
        INSERT INTO audit_log
        (event_time, user_id, user_email, organization_id, event_action, metadata)
        FORMAT CSV`,
        data: [values],
        timeout: 5000,
        queryId: 'create-audit-log',
      });
    } catch (error) {
      this.logger.error('Failed to create audit log event', error);
      Sentry.captureException(error, {
        extra: {
          event,
        },
      });
    }
  }

  async getPaginatedAuditLogs(
    props: QueryAuditLogsArgs,
  ): Promise<{ total: number; data: AuditLogModel[] }> {
    this.logger.info(
      'Getting paginated audit logs (organization=%s, filter=%o, pagination=%o)',
      props.selector.organization,
      props.filter,
      props.pagination,
    );

    if (!props.selector.organization) {
      throw new Error('Organization ID is required');
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    const sqlLimit = sql.raw(props.pagination?.limit?.toString()!);
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    const sqlOffset = sql.raw(props.pagination?.offset?.toString()!);

    let where: SqlValue[] = [];
    where.push(sql`organization_id = ${props.selector.organization}`);

    if (props.filter) {
      if (props.filter?.userId) {
        where.push(sql`user_id = ${props.filter.userId}`);
      }
      if (props.filter?.from && props.filter?.to) {
        const from = formatToClickhouseDateTime(props.filter.from.toISOString());
        const to = formatToClickhouseDateTime(props.filter.to.toISOString());
        where.push(sql`event_time >= ${from} AND event_time <= ${to}`);
      }
    }

    const whereClause = where.length > 0 ? sql`WHERE ${sql.join(where, ' AND ')}` : sql``;

    const result = await this.clickHouse.query({
      query: sql`
        SELECT *
        FROM audit_log
        ${whereClause}
        ORDER BY event_time DESC
        LIMIT ${sqlLimit}
        OFFSET ${sqlOffset}
      `,
      queryId: 'get-audit-logs',
      timeout: 5000,
    });

    const totalResult = await this.clickHouse.query({
      query: sql`
        SELECT *
        FROM audit_log
        ${whereClause}
        ORDER BY event_time DESC
      `,
      queryId: 'get-audit-logs-total',
      timeout: 5000,
    });

    return {
      total: totalResult.rows,
      data: AUDIT_LOG_CLICKHOUSE_ARRAY.parse(result.data),
    };
  }
}
