--non-unique-emails (up)
DROP INDEX
  email_idx;

ALTER TABLE
  public.users
DROP
  CONSTRAINT users_email_key;

ALTER TABLE
  public.users
ADD
  CONSTRAINT users_external_email_key UNIQUE (email, external_auth_user_id);

ALTER TABLE
  public.users
ADD
  display_name VARCHAR(300);

ALTER TABLE
  public.users
ADD
  full_name VARCHAR(300);

UPDATE
  public.users
SET
  display_name = SPLIT_PART(email, '@', 1),
  full_name = SPLIT_PART(email, '@', 1);

ALTER TABLE
  public.users
ALTER COLUMN
  display_name
SET NOT NULL;

ALTER TABLE
  public.users
ALTER COLUMN
  full_name
SET NOT NULL;
