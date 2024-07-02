import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.06.11T10-10-00.ms-teams-webhook.ts',
  run: ({ sql }) => sql`
    ALTER TYPE alert_channel_type ADD VALUE 'MSTEAMS_WEBHOOK';
  `,
} satisfies MigrationExecutor;
