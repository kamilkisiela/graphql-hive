--commit-project-id (up)

ALTER TABLE public.commits
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

UPDATE public.commits as c SET project_id = t.project_id
FROM public.versions as v, public.targets as t
WHERE v.commit_id = c.id AND t.id = v.target_id;

ALTER TABLE public.commits
ALTER COLUMN project_id SET NOT NULL;
