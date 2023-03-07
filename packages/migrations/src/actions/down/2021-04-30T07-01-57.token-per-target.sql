--token-per-target (down)
ALTER TABLE
  public.tokens
DROP COLUMN
  target_id;

ALTER TABLE
  public.tokens
DROP COLUMN
  organization_id;
