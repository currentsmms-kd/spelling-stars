# Fix RLS policies that are causing infinite recursion
# This script will remove the problematic policies and ensure the correct ones are in place

$ErrorActionPreference = "Stop"

# Load environment variables from Doppler
Write-Host "Loading environment variables from Doppler..." -ForegroundColor Cyan
$env:SUPABASE_ACCESS_TOKEN = doppler secrets get SUPABASE_ACCESS_TOKEN --plain
$env:SUPABASE_PROJECT_REF = doppler secrets get VITE_SUPABASE_URL --plain | ForEach-Object {
    if ($_ -match 'https://([^.]+)\.supabase\.co') { $Matches[1] }
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "❌ Error: SUPABASE_ACCESS_TOKEN not found in Doppler" -ForegroundColor Red
    exit 1
}

if (-not $env:SUPABASE_PROJECT_REF) {
    Write-Host "❌ Error: Could not extract project ref from SUPABASE_URL" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Environment variables loaded" -ForegroundColor Green
Write-Host "Project Ref: $env:SUPABASE_PROJECT_REF" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $env:SUPABASE_ACCESS_TOKEN"
    "Content-Type" = "application/json"
}

$baseUrl = "https://api.supabase.com/v1/projects/$env:SUPABASE_PROJECT_REF"

# SQL to fix the policies
$fixSql = @"
-- Drop the problematic policies if they exist
DROP POLICY IF EXISTS "Parents can update child profiles" ON profiles;
DROP POLICY IF EXISTS "Parents can view child profiles" ON profiles;

-- Ensure the correct policies exist
-- (These should already exist from 20251109225900_add_parent_child_relationship.sql)

-- Check if the correct policies exist, if not create them
DO `$`$
BEGIN
    -- Check for SELECT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can view own profile or their children'
    ) THEN
        CREATE POLICY "Users can view own profile or their children"
            ON profiles
            FOR SELECT
            USING (
                id = auth.uid()
                OR parent_id = auth.uid()
            );
    END IF;

    -- Check for UPDATE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can update own profile or their children'
    ) THEN
        CREATE POLICY "Users can update own profile or their children"
            ON profiles
            FOR UPDATE
            USING (
                id = auth.uid()
                OR parent_id = auth.uid()
            )
            WITH CHECK (
                id = auth.uid()
                OR parent_id = auth.uid()
            );
    END IF;
END `$`$;
"@

Write-Host "`nApplying RLS policy fix..." -ForegroundColor Yellow

$body = @{
    query = $fixSql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/database/query" -Method Post -Headers $headers -Body $body
    Write-Host "✓ Successfully fixed RLS policies" -ForegroundColor Green
} catch {
    Write-Host "✗ Error fixing policies: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error details:" -ForegroundColor Red
        Write-Host $errorDetails.message -ForegroundColor Red
    }
    exit 1
}

Write-Host "`n✓ All policies fixed!" -ForegroundColor Green
Write-Host "Please refresh your application." -ForegroundColor Cyan
