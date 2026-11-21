-- ============================================================
-- Offers Table — Complete Schema Patch
-- Supabase → SQL Editor → paste & Run
-- ============================================================

-- 1. is_percentage (BOOLEAN) — the column causing the current error
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS is_percentage BOOLEAN NOT NULL DEFAULT false;

-- 2. is_active (BOOLEAN) — set true for all existing rows
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE offers SET is_active = true WHERE is_active IS NULL;

-- 3. max_discount_value (NUMERIC) — cap for percentage-based promos
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS max_discount_value NUMERIC;

-- 4. terms_conditions (TEXT[]) — array of fine-print strings
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS terms_conditions TEXT[];

-- 5. start_date / end_date — timeline for all offer types
--    (replaces the old valid_from / valid_to naming in the frontend)
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;

ALTER TABLE offers
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- 6. Verification — run this SELECT to confirm all columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'offers'
ORDER BY ordinal_position;
