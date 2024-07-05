import { Injectable, Scope } from 'graphql-modules';
import promClient from 'prom-client';
import { ClickHouse, Logger, sql } from '@hive/api';
import { AuditLogEventAction } from '../../../__generated__/types';
import {
  AuditLogEventWithMethods,
  EventDetailsUnion,
  renderEventHumanReadable,
} from '../AuditLogEventToHumanReadable';

export const auditLogTimingMetric = new promClient.Gauge({
  name: 'audit_log_timing',
  help: 'Time taken to log audit events',
});

export type AuditLogEvent = {
  user?: {
    id: string;
    email: string;
  };
  organizationId?: string | null;
  projectId?: string | null;
  targetId?: string | null;
  schemaVersionId?: string | null;
  eventAction: AuditLogEventAction;
  details: Record<string, any>;
};

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AuditLog {
  constructor(
    private clickHouse: ClickHouse,
    private logger: Logger,
  ) {}

  addNameMethods(event: AuditLogEvent): AuditLogEventWithMethods {
    return {
      ...event,
      details: event.details as EventDetailsUnion,
      getOrganizationName: () => 'org-name',
      getProjectName: () => 'project-name',
    };
  }

  async logAuditEvent(event: AuditLogEvent) {
    const startTime = Date.now();
    const { user, organizationId, projectId, targetId, schemaVersionId, eventAction, details } =
      event;

    const query = sql`
      INSERT INTO audit_log (user_id, user_email, organization_id, project_id, project_name, target_id, target_name, schema_version_id, event_action, event_details, event_human_readable)
      VALUES (
        ${user?.id ?? null},
        ${user?.email ?? null},
        ${organizationId ?? null},
        ${projectId ?? null},
        ${targetId ?? null},
        ${schemaVersionId ?? null},
        ${eventAction},
        ${JSON.stringify(details)},
        ${renderEventHumanReadable(this.addNameMethods(event))}
      )
    `;

    const insertResult = this.clickHouse.query({
      query,
      queryId: 'audit-log-insert',
      timeout: 10000,
    });

    auditLogTimingMetric.inc(startTime - Date.now());
    return insertResult;
  }
}
