-- ============================================================
-- MIGRATION: 001_system_settings_config.sql
-- ASA Vendor Platform — Centralized Configuration Table
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- STEP 1: Create the system_settings table
-- This is a single-row config table (singleton pattern).
-- All API keys and service configurations are stored here.
CREATE TABLE IF NOT EXISTS public.system_settings (
    id                          BIGINT PRIMARY KEY DEFAULT 1,   -- Always 1, singleton row
    
    -- === SMS / OTP Service ===
    otp_api_key                 TEXT,                           -- Rainfire SMS API Key
    sms_endpoint                TEXT,                           -- SMS API base URL (no query params)
    
    -- === Grocery / Ordering Restrictions ===
    is_grocery_order_restricted BOOLEAN NOT NULL DEFAULT TRUE,  -- TRUE = vendors CAN order grocery
    
    -- === App / Platform Config ===
    support_email               TEXT,                           -- Support email shown to vendors
    support_whatsapp            TEXT,                           -- WhatsApp number (with country code, no +)
    app_version                 TEXT DEFAULT '1.0.0',           -- Current app version string
    maintenance_mode            BOOLEAN NOT NULL DEFAULT FALSE, -- If TRUE, show maintenance screen to all vendors
    admin_commission_percent    NUMERIC(5, 2) DEFAULT 10.00,    -- Platform commission % on each order
    
    -- === Timestamps ===
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- === Safety Constraint: Enforce Singleton Row ===
    CONSTRAINT system_settings_singleton CHECK (id = 1)
);

-- STEP 2: Add a trigger to auto-update the 'updated_at' timestamp on every change
CREATE OR REPLACE FUNCTION public.update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_system_settings_timestamp();

-- STEP 3: Insert your initial configuration row
-- IMPORTANT: Replace the placeholder values below with your real credentials.
INSERT INTO public.system_settings (
    id,
    otp_api_key,
    sms_endpoint,
    is_grocery_order_restricted,
    support_email,
    support_whatsapp,
    app_version,
    maintenance_mode,
    admin_commission_percent
) VALUES (
    1,
    '9fd98f856d3ca2086168f264a117ed7c',    -- << Your Rainfire SMS API Key
    'https://sms.renflair.in/V1.php',       -- << Rainfire SMS endpoint (no query params)
    TRUE,                                   -- TRUE = grocery ordering is ENABLED for vendors
    'support@asafood.com',                  -- << Your support email
    '919000000000',                         -- << Your WhatsApp number with country code (no +)
    '1.0.0',
    FALSE,                                  -- maintenance_mode = FALSE (site is live)
    10.00                                   -- 10% commission
)
ON CONFLICT (id) DO UPDATE SET
    otp_api_key               = EXCLUDED.otp_api_key,
    sms_endpoint              = EXCLUDED.sms_endpoint,
    is_grocery_order_restricted = EXCLUDED.is_grocery_order_restricted,
    support_email             = EXCLUDED.support_email,
    support_whatsapp          = EXCLUDED.support_whatsapp,
    app_version               = EXCLUDED.app_version,
    maintenance_mode          = EXCLUDED.maintenance_mode,
    admin_commission_percent  = EXCLUDED.admin_commission_percent,
    updated_at                = NOW();

-- STEP 4: Enable Row-Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated vendors to only READ the config (not write/update)
-- The service_role (admin) can still do anything.
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.system_settings;
CREATE POLICY "Allow read for authenticated users"
    ON public.system_settings
    FOR SELECT
    USING (true); -- Any authenticated or anon user can read (keys fetched at runtime by frontend)

-- Block all writes from the frontend / anon users
DROP POLICY IF EXISTS "Block all writes from public" ON public.system_settings;
CREATE POLICY "Block all writes from public"
    ON public.system_settings
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Grant SELECT to anon and authenticated roles
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT ON public.system_settings TO authenticated;

-- ============================================================
-- DONE. Verify by running:
--   SELECT * FROM public.system_settings;
-- ============================================================
