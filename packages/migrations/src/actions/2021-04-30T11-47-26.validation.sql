--validation (up)
ALTER TABLE
  public.targets
ADD COLUMN
  validation_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE
  public.targets
ADD COLUMN
  validation_period SMALLINT NOT NULL DEFAULT 30;

ALTER TABLE
  public.targets
ADD COLUMN
  validation_percentage FLOAT NOT NULL DEFAULT 0.00;
