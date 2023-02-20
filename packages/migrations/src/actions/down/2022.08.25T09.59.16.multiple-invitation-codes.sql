DROP TABLE organization_invitations;

ALTER table public.organizations ADD COLUMN invite_code invite_code varchar(10) NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 0, 10);