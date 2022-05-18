--slack-integration (up)

ALTER TABLE public.organizations ADD COLUMN github_app_installation_id text;
ALTER TABLE public.projects ADD COLUMN git_repository text;