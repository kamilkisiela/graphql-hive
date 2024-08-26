import { Injectable, Scope } from 'graphql-modules';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { QueryAuditLogsArgs } from '../../../__generated__/types.next';
import { User } from '../../../shared/entities';
import { ClickHouse, sql } from '../../operations/providers/clickhouse-client';
import { SqlValue } from '../../operations/providers/sql';
import { Logger } from '../../shared/providers/logger';
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
    this.logger = logger.child({ source: 'AuditLogsManager' });
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
      'Getting paginated audit logs (limit=%s, offset=%s, orgId=%s, userId=%s, action=%s)',
      props.selector.organization,
      props.filter?.endDate,
      props.filter?.startDate,
      props.filter?.userId,
    );

    // Handle the limit and offset for pagination
    // let limit: SqlValue[] = [];
    // let offset: SqlValue[] = [];
    // if (props?.pagination?.limit) {
    //   limit.push(sql`LIMIT ${String(props.pagination.limit)}`);
    // } else {
    //   limit.push(sql`LIMIT 25`);
    // }
    // if (props?.pagination?.offset) {
    //   offset.push(sql`OFFSET ${String(props.pagination.offset)}`);
    // } else {
    //   offset.push(sql`OFFSET 0`);
    // }
    const limit = props.pagination?.limit ?? 25;
    const sqlLimit = sql.raw(limit.toString());
    const offset = props.pagination?.offset ?? 0;
    const sqlOffset = sql.raw(offset.toString());

    const where: SqlValue[] = [];
    if (props.selector.organization) {
      where.push(sql`organization_id = ${props.selector.organization}`);
    } else {
      // Handle case where organization_id is not provided
      this.logger.warn('No organization_id provided in query');
    }

    if (props.filter) {
      // if (props.filter?.startDate) {
      //   const dateIso = new Date(props.filter.startDate).toISOString();
      //   where.push(sql`event_time >= ${dateIso}`);
      // }
      // if (props.filter?.endDate) {
      //   const dateIso = new Date(props.filter.endDate).toISOString();
      //   where.push(sql`event_time <= ${dateIso}`);
      // }
      if (props.filter?.userId) {
        where.push(sql`user_id = ${props.filter.userId}`);
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

    return {
      total: result.rows,
      data: AUDIT_LOG_CLICKHOUSE_ARRAY.parse(result.data),
    };
  }
}
