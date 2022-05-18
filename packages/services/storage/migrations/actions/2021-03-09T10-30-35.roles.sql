--roles (up)

CREATE TYPE user_role AS ENUM ('ADMIN', 'MEMBER');

ALTER TABLE public.organization_member
ADD COLUMN role user_role NOT NULL DEFAULT 'MEMBER';

UPDATE public.organization_member as om SET role = 'ADMIN'
WHERE
(
  SELECT o.user_id
  FROM public.organizations as o WHERE o.id = om.organization_id AND o.user_id = om.user_id
) IS NOT NULL;