-- Update Hobby with 3d to 7d
UPDATE
  public.organizations
SET
  limit_retention_days = 7
WHERE
  plan_name = 'HOBBY'
  AND limit_retention_days = 3;

-- Update Pro with 180d to 90d
UPDATE
  public.organizations
SET
  limit_retention_days = 90
WHERE
  plan_name = 'PRO'
  AND limit_retention_days = 180;
