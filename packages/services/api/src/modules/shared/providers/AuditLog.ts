import { ClickHouse, Logger, sql } from "@hive/api";
import { Injectable, Scope } from "graphql-modules";
import promClient from 'prom-client';
import { AuditLogEventAction } from "../../../__generated__/types";

export const auditLogTimingMetric = new promClient.Gauge({
  name: 'audit_log_timing',
  help: 'Time taken to log audit events',
});


type AuditLogEvent = {
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
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AuditLog {
  constructor(
    private clickHouse: ClickHouse,
    private logger: Logger,
  ) {}

  logAuditEvent (event: AuditLogEvent) {
    const startTime = Date.now();
    const { user, organizationId, projectId, targetId, schemaVersionId, eventAction, details } = event;

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
        ${renderEventHumanReadable(event)}
      )
    `;
    
    const insertResult = this.clickHouse.query({
        query
      });

    auditLogTimingMetric.inc(startTime - Date.now());
    return insertResult;
  };
}