ALTER TABLE public.organizations DROP COLUMN invite_code;

CREATE TABLE public.organization_invitations (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code varchar(10) NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 0, 10),
  email VARCHAR(320) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + INTERVAL '7 days',
  PRIMARY KEY (organization_id, email)
);

