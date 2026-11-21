-- =============================================================================
-- ASA FOOD: products_migration.sql
-- Run ONCE in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ── 1. Add qty_per_unit column ──────────────────────────────────────────────
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS qty_per_unit TEXT DEFAULT '1';

-- ── 2. Add flat TIME columns for fast timing-window filtering ───────────────
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS timing_start TIME DEFAULT '00:00:00';

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS timing_end TIME DEFAULT '23:59:00';

-- ── 3. Backfill timing_start / timing_end from existing timing JSONB data ───
UPDATE public.products
SET
  timing_start = CASE
    WHEN timing IS NOT NULL AND (timing->>'start') IS NOT NULL
         AND (timing->>'start') ~ '^\d{2}:\d{2}(:\d{2})?$'
    THEN (timing->>'start')::TIME
    ELSE '00:00:00'::TIME
  END,
  timing_end = CASE
    WHEN timing IS NOT NULL AND (timing->>'end') IS NOT NULL
         AND (timing->>'end') ~ '^\d{2}:\d{2}(:\d{2})?$'
    THEN (timing->>'end')::TIME
    ELSE '23:59:00'::TIME
  END;

-- ── 4. Customer-Facing View: products available RIGHT NOW ───────────────────
--      Conditions:
--        a) is_available = TRUE  (vendor toggle on)
--        b) Current IST time is within timing_start..timing_end
--        c) stock > 0
CREATE OR REPLACE VIEW public.products_available_now AS
SELECT
    p.*,
    -- Is this item within its timing window right now?
    CASE
        WHEN p.timing_end > p.timing_start THEN
            (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME
                BETWEEN p.timing_start AND p.timing_end
        ELSE
            -- Overnight window (e.g. 22:00 → 02:00)
            (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME >= p.timing_start
            OR (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME <= p.timing_end
    END AS is_in_timing_window
FROM public.products p
WHERE
    p.is_available = TRUE
    AND COALESCE(p.stock, 1) > 0
    AND (
        p.timing_start IS NULL
        OR p.timing_end IS NULL
        OR (
            CASE
                WHEN p.timing_end > p.timing_start THEN
                    (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME
                        BETWEEN p.timing_start AND p.timing_end
                ELSE
                    (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME >= p.timing_start
                    OR (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME <= p.timing_end
            END
        )
    );

COMMENT ON VIEW public.products_available_now IS
'Customer app view: returns only is_available=true products within current IST timing window.';

-- ── 5. Recommended Products View ────────────────────────────────────────────
--      Products shown in "Recommended for You" section on customer app.
--      Vendor controls this via the ON/OFF toggle (is_manual_recommend).
CREATE OR REPLACE VIEW public.products_recommended AS
SELECT *
FROM public.products_available_now
WHERE is_manual_recommend = TRUE;

COMMENT ON VIEW public.products_recommended IS
'Customer Recommended section: available products where vendor enabled recommendation toggle.';

-- ── 6. Grant read permissions to customer app ────────────────────────────────
GRANT SELECT ON public.products_available_now TO anon;
GRANT SELECT ON public.products_available_now TO authenticated;
GRANT SELECT ON public.products_recommended TO anon;
GRANT SELECT ON public.products_recommended TO authenticated;

-- =============================================================================
-- VERIFY after running (copy-paste and run separately):
-- =============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' ORDER BY ordinal_position;
--
-- SELECT name, is_available, timing_start, timing_end, is_manual_recommend
-- FROM products_available_now LIMIT 10;
--
-- SELECT name, is_manual_recommend FROM products_recommended LIMIT 10;
