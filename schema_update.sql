-- SQL Migration: Add Weekly Operation Timing to Vendors Table
-- Target Table: vendors
-- Action: Add 'timing' column with JSONB data type for dynamic operating hours

ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS timing jsonb DEFAULT '{}'::jsonb;

-- Comment for clear documentation
COMMENT ON COLUMN public.vendors.timing IS 'Holds operating hours for all 7 days (isOpen, open, close) as a nested JSONB object';
