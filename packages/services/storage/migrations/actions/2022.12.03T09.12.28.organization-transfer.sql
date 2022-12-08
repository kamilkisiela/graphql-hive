ALTER TABLE public.organizations
  ADD COLUMN ownership_transfer_user_id uuid REFERENCES public.users(id),
  ADD COLUMN ownership_transfer_code varchar(10),
  ADD COLUMN ownership_transfer_expires_at TIMESTAMP WITH TIME ZONE
;