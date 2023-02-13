-- Update Hobby with 3d to 7d - personal orgs were created with the default value of 3d
UPDATE public.organizations SET limit_retention_days = 7 WHERE plan_name = 'HOBBY' AND limit_retention_days = 3;

-- Update limit_retention_days default value to 7
ALTER table public.organizations ALTER COLUMN limit_retention_days SET DEFAULT 7;