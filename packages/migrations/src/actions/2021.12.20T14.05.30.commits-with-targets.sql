--creates and fills a target_id column on public.commits

ALTER TABLE public.commits
ADD COLUMN target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE;

UPDATE public.commits as c SET target_id = v.target_id
FROM public.versions as v
WHERE v.commit_id = c.id;

ALTER TABLE public.commits
ALTER COLUMN target_id SET NOT NULL;

