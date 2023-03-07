--token-last-used-at (down)
ALTER TABLE
  public.tokens
DROP COLUMN
  last_used_at;
