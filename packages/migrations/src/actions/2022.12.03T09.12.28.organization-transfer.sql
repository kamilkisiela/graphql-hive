ALTER TABLE
  public.organizations
ADD COLUMN
  ownership_transfer_user_id UUID REFERENCES public.users (id),
ADD COLUMN
  ownership_transfer_code VARCHAR(10),
ADD COLUMN
  ownership_transfer_expires_at TIMESTAMP WITH TIME ZONE;
