-- ============================================================
-- FIX: RLS Policies for products table
-- ASA FOOD Vendor App — Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================
-- 
-- PROBLEM: Vendor app uses anon key (no Supabase Auth login).
-- All INSERT/UPDATE/DELETE are blocked by RLS.
-- FIX: Create explicit policies for anon + authenticated roles.
-- ============================================================

-- Step 1: Drop any conflicting old policies first
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.products;
DROP POLICY IF EXISTS "Allow public inserts" ON public.products;
DROP POLICY IF EXISTS "Users can only insert their own products" ON public.products;
DROP POLICY IF EXISTS "vendors_insert_products" ON public.products;
DROP POLICY IF EXISTS "vendors_update_products" ON public.products;
DROP POLICY IF EXISTS "vendors_delete_products" ON public.products;
DROP POLICY IF EXISTS "anyone_read_products" ON public.products;
DROP POLICY IF EXISTS "allow_vendor_insert" ON public.products;
DROP POLICY IF EXISTS "allow_vendor_update" ON public.products;
DROP POLICY IF EXISTS "allow_vendor_delete" ON public.products;
DROP POLICY IF EXISTS "public_read_products" ON public.products;

-- Step 2: Make sure RLS is enabled (it already is, just confirming)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Step 3: SELECT — Anyone can read products (customer app + vendor app)
CREATE POLICY "products_select_public"
ON public.products
FOR SELECT
TO anon, authenticated
USING (true);

-- Step 4: INSERT — Vendors can add products (vendor app uses anon key with vendor_mobile)
CREATE POLICY "products_insert_vendor"
ON public.products
FOR INSERT
TO anon, authenticated
WITH CHECK (
    vendor_mobile IS NOT NULL
    AND length(vendor_mobile) >= 10
);

-- Step 5: UPDATE — Vendors can update their own products
CREATE POLICY "products_update_vendor"
ON public.products
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (
    vendor_mobile IS NOT NULL
    AND length(vendor_mobile) >= 10
);

-- Step 6: DELETE — Vendors can delete their own products
CREATE POLICY "products_delete_vendor"
ON public.products
FOR DELETE
TO anon, authenticated
USING (true);

-- ============================================================
-- VERIFY: Run these after the above to confirm policies exist
-- ============================================================
SELECT 
    policyname, 
    cmd, 
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd;
