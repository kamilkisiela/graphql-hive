--github-integration (down)
ALTER TABLE
  public.organizations
DROP COLUMN
  github_app_installation_id;

ALTER TABLE
  public.projects
DROP COLUMN
  git_repository;
