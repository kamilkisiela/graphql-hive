import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2021-06-11T15-38-28.alerts.sql',
  run: ({ sql }) => sql`
--alerts (up)
CREATE TYPE
  alert_channel_type AS ENUM('SLACK', 'WEBHOOK');

CREATE TYPE
  alert_type AS ENUM('SCHEMA_CHANGE_NOTIFICATIONS');

CREATE TABLE
  public.alert_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    TYPE
      alert_channel_type NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      NAME TEXT NOT NULL,
      slack_channel TEXT,
      webhook_endpoint TEXT,
      project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE
  );

CREATE TABLE
  public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    TYPE
      alert_type NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      alert_channel_id UUID NOT NULL REFERENCES public.alert_channels (id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
      target_id UUID NOT NULL REFERENCES public.targets (id) ON DELETE CASCADE
  );
`
} satisfies MigrationExecutor
