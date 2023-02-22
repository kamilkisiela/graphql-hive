-- Find and delete all organizations of type PERSONAL that have no projects
DELETE FROM public.organizations as o
WHERE
  o.type = 'PERSONAL'
  AND NOT EXISTS (
    SELECT id from public.projects as p WHERE p.org_id = o.id LIMIT 1
  );

-- Delete the "type" column from organizations
ALTER TABLE public.organizations DROP COLUMN type;

-- Delete the "organization_type" enum, as it's unused now
DROP TYPE organization_type;
