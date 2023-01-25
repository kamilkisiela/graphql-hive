--roles (down)

ALTER TABLE public.organization_member DROP COLUMN role;
DROP TYPE IF EXISTS user_role;