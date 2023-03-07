ALTER TABLE
  public.users
ADD COLUMN
  supertoken_user_id VARCHAR(50),
ADD
  CONSTRAINT supertoken_user_id_unique UNIQUE (supertoken_user_id),
ALTER COLUMN
  external_auth_user_id
DROP NOT NULL
,
ADD COLUMN
  "is_admin" BOOLEAN;
