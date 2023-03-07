--creates and fills a target_id column on public.commits
ALTER TABLE
  public.commits
DROP COLUMN
  target_id;
