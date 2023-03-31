--roles (down)
ALTER TABLE
  public.organization_member
DROP COLUMN
  ROLE;

DROP TYPE
  IF EXISTS user_role;
