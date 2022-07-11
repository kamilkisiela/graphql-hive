-- Update Hobby with 7d to 3d
UPDATE public.organizations SET limit_retention_days = 3 WHERE plan_name = 'HOBBY' AND limit_retention_days = 7;

-- Update Pro with 180d to 90d
UPDATE public.organizations SET limit_retention_days = 180 WHERE plan_name = 'PRO' AND limit_retention_days = 90;