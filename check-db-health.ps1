# Check Supabase Database Health
# This script runs common database health checks

$ErrorActionPreference = "Stop"

$projectRef = "tucdqibvxioxbeyrbsef"

Write-Host "=== SUPABASE DATABASE HEALTH CHECK ===" -ForegroundColor Yellow
Write-Host "Project: spelling-stars ($projectRef)" -ForegroundColor Green
Write-Host ""

# Function to execute SQL query
function Invoke-SupabaseQuery {
    param(
        [string]$Query,
        [string]$Description
    )

    Write-Host "Checking: $Description" -ForegroundColor Cyan

    try {
        $body = @{
            query = $Query
        } | ConvertTo-Json

        $result = Invoke-RestMethod `
            -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
            -Method POST `
            -Headers @{
                Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Body $body

        return $result
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return $null
    }
}

# 1. Check for tables without primary keys
Write-Host ""
Write-Host "1. Tables without Primary Keys" -ForegroundColor Yellow
$query1 = @"
SELECT
    schemaname,
    tablename
FROM pg_tables pt
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint pc
        WHERE pc.conrelid = (pt.schemaname || '.' || pt.tablename)::regclass
            AND pc.contype = 'p'
    )
ORDER BY schemaname, tablename;
"@
$result1 = Invoke-SupabaseQuery -Query $query1 -Description "Tables without primary keys"
if ($result1) { $result1 | ConvertTo-Json -Depth 5 }

# 2. Check for indexes that are never used
Write-Host ""
Write-Host "2. Unused Indexes" -ForegroundColor Yellow
$query2 = @"
SELECT
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND schemaname = 'public'
    AND indexrelname NOT LIKE '%_pkey'
ORDER BY schemaname, relname, indexrelname;
"@
$result2 = Invoke-SupabaseQuery -Query $query2 -Description "Unused indexes"
if ($result2) { $result2 | ConvertTo-Json -Depth 5 }

# 3. Check for missing foreign key indexes
Write-Host ""
Write-Host "3. Missing Foreign Key Indexes" -ForegroundColor Yellow
$query3 = @"
SELECT
    c.conrelid::regclass AS table_name,
    a.attname AS column_name,
    c.conname AS constraint_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
    AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
            AND a.attnum = ANY(i.indkey)
    )
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY table_name, column_name;
"@
$result3 = Invoke-SupabaseQuery -Query $query3 -Description "Missing foreign key indexes"
if ($result3) { $result3 | ConvertTo-Json -Depth 5 }

# 4. Check for tables without Row Level Security
Write-Host ""
Write-Host "4. Tables without RLS Enabled" -ForegroundColor Yellow
$query4 = @"
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = false
ORDER BY tablename;
"@
$result4 = Invoke-SupabaseQuery -Query $query4 -Description "Tables without RLS"
if ($result4) { $result4 | ConvertTo-Json -Depth 5 }

# 5. Check for tables with no RLS policies
Write-Host ""
Write-Host "5. Tables with RLS Enabled but No Policies" -ForegroundColor Yellow
$query5 = @"
SELECT
    t.schemaname,
    t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = t.schemaname
            AND p.tablename = t.tablename
    )
ORDER BY t.tablename;
"@
$result5 = Invoke-SupabaseQuery -Query $query5 -Description "Tables with RLS but no policies"
if ($result5) { $result5 | ConvertTo-Json -Depth 5 }

# 6. Check for duplicate indexes
Write-Host ""
Write-Host "6. Duplicate Indexes" -ForegroundColor Yellow
$query6 = @"
SELECT
    indrelid::regclass AS table_name,
    array_agg(indexrelid::regclass) AS indexes
FROM pg_index
WHERE indrelid IN (
    SELECT indrelid
    FROM pg_index
    WHERE indrelid::regclass::text LIKE 'public.%'
    GROUP BY indrelid, indkey
    HAVING COUNT(*) > 1
)
GROUP BY indrelid, indkey
HAVING COUNT(*) > 1;
"@
$result6 = Invoke-SupabaseQuery -Query $query6 -Description "Duplicate indexes"
if ($result6) { $result6 | ConvertTo-Json -Depth 5 }

# 7. Check table sizes
Write-Host ""
Write-Host "7. Table Sizes" -ForegroundColor Yellow
$query7 = @"
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"@
$result7 = Invoke-SupabaseQuery -Query $query7 -Description "Table sizes"
if ($result7) { $result7 | ConvertTo-Json -Depth 5 }

# 8. Check for security definer functions
Write-Host ""
Write-Host "8. Security Definer Functions" -ForegroundColor Yellow
$query8 = @"
SELECT
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND prosecdef = true
ORDER BY p.proname;
"@
$result8 = Invoke-SupabaseQuery -Query $query8 -Description "Security definer functions"
if ($result8) { $result8 | ConvertTo-Json -Depth 5 }

Write-Host ""
Write-Host "=== HEALTH CHECK COMPLETE ===" -ForegroundColor Green
