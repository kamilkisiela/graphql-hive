--alerts (up)

CREATE TYPE alert_channel_type AS ENUM ('SLACK', 'WEBHOOK');
CREATE TYPE alert_type AS ENUM ('SCHEMA_CHANGE_NOTIFICATIONS');

CREATE TABLE public.alert_channels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type alert_channel_type NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  name text NOT NULL,
  slack_channel text,
  webhook_endpoint text,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type alert_type NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  alert_channel_id uuid NOT NULL REFERENCES public.alert_channels(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE
);