import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021-08-27T14-19-48.non-unique-emails.sql',
  run: ({ sql }) => sql`
--non-unique-emails (up)
DROP INDEX
  email_idx;

ALTER TABLE
  users
DROP
  CONSTRAINT users_email_key;

ALTER TABLE
  users
ADD
  CONSTRAINT users_external_email_key UNIQUE (email, external_auth_user_id);

ALTER TABLE
  users
ADD
  display_name VARCHAR(300);

ALTER TABLE
  users
ADD
  full_name VARCHAR(300);

UPDATE
  users
SET
  display_name = SPLIT_PART(email, '@', 1),
  full_name = SPLIT_PART(email, '@', 1);

ALTER TABLE
  users
ALTER COLUMN
  display_name
SET NOT NULL;

ALTER TABLE
  users
ALTER COLUMN
  full_name
SET NOT NULL;
`,
} satisfies MigrationExecutor;
