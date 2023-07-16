import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2021-03-09T14-02-34.activities.sql',
  run: ({ sql }) => sql`
--activities (up)
CREATE TABLE
  public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects (id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.targets (id) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL,
    activity_metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );
`
} satisfies MigrationExecutor
