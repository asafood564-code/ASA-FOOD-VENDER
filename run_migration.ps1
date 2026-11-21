# =============================================================================
# run_migration.ps1
# ASA FOOD — Supabase Products Table Migration Runner
# =============================================================================
# HOW TO RUN:
#   1. Get your Personal Access Token from:
#      https://supabase.com/dashboard/account/tokens
#   2. Open PowerShell in this folder
#   3. Run: .\run_migration.ps1
# =============================================================================

$PROJECT_REF = "hwddmjolzmdurijaitia"
$SUPABASE_URL = "https://$PROJECT_REF.supabase.co"

# ── ENTER YOUR PERSONAL ACCESS TOKEN HERE ────────────────────────────────────
# Get it from: https://supabase.com/dashboard/account/tokens  → New Token
$PAT = ""   # <-- Paste your token between the quotes
# ─────────────────────────────────────────────────────────────────────────────

if (-not $PAT) {
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ERROR: Personal Access Token (PAT) is missing!" -ForegroundColor Red
    Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Steps:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://supabase.com/dashboard/account/tokens"
    Write-Host "  2. Click 'Generate new token'"
    Write-Host "  3. Copy the token"
    Write-Host "  4. Open this file (run_migration.ps1)"
    Write-Host "  5. Paste the token inside the quotes next to `$PAT = `"`""
    Write-Host "  6. Save and run again: .\run_migration.ps1"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ASA FOOD — Products Migration Starting..." -ForegroundColor Cyan
Write-Host "  Project: $PROJECT_REF" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$mgmtHeaders = @{
    "Authorization" = "Bearer $PAT"
    "Content-Type"  = "application/json"
}

# Helper function to run SQL via Management API
function Run-SQL {
    param([string]$Label, [string]$SQL)
    
    Write-Host "  ▶ $Label..." -ForegroundColor Yellow -NoNewline
    
    $body = @{ query = $SQL } | ConvertTo-Json
    
    try {
        $resp = Invoke-RestMethod `
            -Uri "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" `
            -Method POST `
            -Headers $mgmtHeaders `
            -Body $body `
            -ErrorAction Stop
        Write-Host " ✅ Done" -ForegroundColor Green
        return $true
    } catch {
        $errBody = $_.ErrorDetails.Message
        Write-Host " ❌ FAILED" -ForegroundColor Red
        Write-Host "     Error: $errBody" -ForegroundColor Red
        return $false
    }
}

$allOk = $true

# ── STEP 1: Add qty_per_unit ──────────────────────────────────────────────────
$ok = Run-SQL "Adding qty_per_unit column" @"
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS qty_per_unit TEXT DEFAULT '1';
"@
if (-not $ok) { $allOk = $false }

# ── STEP 2: Add timing_start ─────────────────────────────────────────────────
$ok = Run-SQL "Adding timing_start column" @"
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS timing_start TIME DEFAULT '00:00:00';
"@
if (-not $ok) { $allOk = $false }

# ── STEP 3: Add timing_end ───────────────────────────────────────────────────
$ok = Run-SQL "Adding timing_end column" @"
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS timing_end TIME DEFAULT '23:59:00';
"@
if (-not $ok) { $allOk = $false }

# ── STEP 4: Backfill timing_start/end from timing JSONB ──────────────────────
$ok = Run-SQL "Backfilling timing columns from existing JSONB data" @"
UPDATE public.products
SET
  timing_start = CASE
    WHEN timing IS NOT NULL
     AND timing->>'start' IS NOT NULL
     AND timing->>'start' ~ '^\d{2}:\d{2}'
    THEN (timing->>'start')::TIME
    ELSE '00:00:00'::TIME
  END,
  timing_end = CASE
    WHEN timing IS NOT NULL
     AND timing->>'end' IS NOT NULL
     AND timing->>'end' ~ '^\d{2}:\d{2}'
    THEN (timing->>'end')::TIME
    ELSE '23:59:00'::TIME
  END;
"@
if (-not $ok) { $allOk = $false }

# ── STEP 5: Backfill qty_per_unit from additional_details ────────────────────
$ok = Run-SQL "Backfilling qty_per_unit from additional_details" @"
UPDATE public.products
SET qty_per_unit = COALESCE(
    additional_details->>'qty_per_unit',
    '1'
)
WHERE qty_per_unit IS NULL OR qty_per_unit = '1';
"@
if (-not $ok) { $allOk = $false }

# ── STEP 6: Customer-facing available-now VIEW ────────────────────────────────
$ok = Run-SQL "Creating products_available_now view" @"
CREATE OR REPLACE VIEW public.products_available_now AS
SELECT
    p.*,
    CASE
        WHEN p.timing_end > p.timing_start THEN
            (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME
                BETWEEN p.timing_start AND p.timing_end
        ELSE
            (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME >= p.timing_start
            OR (CURRENT_TIME AT TIME ZONE 'Asia/Kolkata')::TIME <= p.timing_end
    END AS is_in_timing_window
FROM public.products p
WHERE
    p.is_available = TRUE
    AND COALESCE(p.stock, 1) > 0
    AND (
        p.timing_start IS NULL OR p.timing_end IS NULL
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
"@
if (-not $ok) { $allOk = $false }

# ── STEP 7: Recommended products VIEW ────────────────────────────────────────
$ok = Run-SQL "Creating products_recommended view" @"
CREATE OR REPLACE VIEW public.products_recommended AS
SELECT * FROM public.products_available_now
WHERE is_manual_recommend = TRUE;
"@
if (-not $ok) { $allOk = $false }

# ── STEP 8: Grant permissions ────────────────────────────────────────────────
$ok = Run-SQL "Granting read permissions on views" @"
GRANT SELECT ON public.products_available_now TO anon;
GRANT SELECT ON public.products_available_now TO authenticated;
GRANT SELECT ON public.products_recommended TO anon;
GRANT SELECT ON public.products_recommended TO authenticated;
"@
if (-not $ok) { $allOk = $false }

# ── VERIFY ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Verifying columns..." -ForegroundColor Cyan

$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZGRtam9sem1kdXJpamFpdGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzYyNDcsImV4cCI6MjA5MjcxMjI0N30.qC4F-PSpWqHBHFhXAADNyIyyUNJ_P05N4j-Zxoz3hkU"
$restHeaders = @{
    "apikey"        = $anonKey
    "Authorization" = "Bearer $anonKey"
}

$checks = @(
    @{ Label = "qty_per_unit";  URL = "$SUPABASE_URL/rest/v1/products?select=qty_per_unit&limit=1" },
    @{ Label = "timing_start";  URL = "$SUPABASE_URL/rest/v1/products?select=timing_start&limit=1" },
    @{ Label = "timing_end";    URL = "$SUPABASE_URL/rest/v1/products?select=timing_end&limit=1" },
    @{ Label = "products_available_now view"; URL = "$SUPABASE_URL/rest/v1/products_available_now?limit=1" },
    @{ Label = "products_recommended view";   URL = "$SUPABASE_URL/rest/v1/products_recommended?limit=1" }
)

foreach ($check in $checks) {
    Write-Host "  ▶ Checking $($check.Label)..." -ForegroundColor Yellow -NoNewline
    try {
        $r = Invoke-RestMethod -Uri $check.URL -Headers $restHeaders -ErrorAction Stop
        Write-Host " ✅ EXISTS" -ForegroundColor Green
    } catch {
        Write-Host " ❌ NOT FOUND" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════"
if ($allOk) {
    Write-Host "  ✅ MIGRATION COMPLETE — All steps passed!" -ForegroundColor Green
    Write-Host "  Products now support: timing filter, available-now view," -ForegroundColor Green
    Write-Host "  recommended section, qty_per_unit column." -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Some steps failed. Check errors above." -ForegroundColor Yellow
    Write-Host "  You can also run products_migration.sql manually in:" -ForegroundColor Yellow
    Write-Host "  https://supabase.com/dashboard/project/$PROJECT_REF/sql/new" -ForegroundColor Cyan
}
Write-Host "══════════════════════════════════════════════════════"
Write-Host ""
