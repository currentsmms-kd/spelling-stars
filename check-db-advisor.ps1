# Supabase Database Advisor - Application-Specific Checks
# Focuses on SpellStars-specific schema requirements

$ErrorActionPreference = "Stop"

$projectRef = "tucdqibvxioxbeyrbsef"

Write-Host "=== SPELLSTARS DATABASE ADVISOR ===" -ForegroundColor Yellow
Write-Host "Project: spelling-stars" -ForegroundColor Green
Write-Host ""

function Invoke-SupabaseQuery {
    param(
        [string]$Query,
        [string]$Description
    )

    try {
        $body = @{ query = $Query } | ConvertTo-Json

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
        Write-Host "Error executing query: $_" -ForegroundColor Red
        return $null
    }
}

$issuesFound = @()
$warnings = @()
$recommendations = @()

# Check 1: Verify critical indexes exist
Write-Host "✓ Check 1: Verifying Critical Indexes" -ForegroundColor Cyan
$query = @"
SELECT
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname IN (
        'idx_srs_due_date',
        'idx_attempts_child_word',
        'idx_list_words_list_id',
        'idx_session_analytics_child_date'
    );
"@
$result = Invoke-SupabaseQuery -Query $query -Description "Critical indexes"
if ($result) {
    $expectedIndexes = @('idx_srs_due_date', 'idx_attempts_child_word', 'idx_list_words_list_id', 'idx_session_analytics_child_date')
    $foundIndexes = $result | ForEach-Object { $_.indexname }

    foreach ($expected in $expectedIndexes) {
        if ($expected -notin $foundIndexes) {
            $issuesFound += "Missing critical index: $expected"
            Write-Host "  ✗ Missing: $expected" -ForegroundColor Red
        } else {
            Write-Host "  ✓ Found: $expected" -ForegroundColor Green
        }
    }
}
Write-Host ""

# Check 2: RLS Policies on all public tables
Write-Host "✓ Check 2: Row Level Security Policies" -ForegroundColor Cyan
$query = @"
SELECT
    t.tablename,
    t.rowsecurity,
    COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
"@
$result = Invoke-SupabaseQuery -Query $query -Description "RLS policies"
if ($result) {
    foreach ($table in $result) {
        if (-not $table.rowsecurity) {
            $issuesFound += "Table '$($table.tablename)' does not have RLS enabled"
            Write-Host "  ✗ $($table.tablename): RLS DISABLED" -ForegroundColor Red
        } elseif ($table.policy_count -eq 0) {
            $issuesFound += "Table '$($table.tablename)' has RLS enabled but no policies"
            Write-Host "  ✗ $($table.tablename): RLS enabled but NO POLICIES" -ForegroundColor Red
        } else {
            Write-Host "  ✓ $($table.tablename): RLS enabled with $($table.policy_count) policies" -ForegroundColor Green
        }
    }
}
Write-Host ""

# Check 3: Foreign Key Indexes
Write-Host "✓ Check 3: Foreign Key Indexes" -ForegroundColor Cyan
$query = @"
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
                AND tablename = tc.table_name
                AND indexdef LIKE '%' || kcu.column_name || '%'
        ) THEN true
        ELSE false
    END as has_index
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
"@
$result = Invoke-SupabaseQuery -Query $query -Description "Foreign key indexes"
if ($result) {
    foreach ($fk in $result) {
        if (-not $fk.has_index) {
            $warnings += "Foreign key '$($fk.table_name).$($fk.column_name)' should have an index for performance"
            Write-Host "  ⚠ $($fk.table_name).$($fk.column_name): Missing index" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ $($fk.table_name).$($fk.column_name): Indexed" -ForegroundColor Green
        }
    }
}
Write-Host ""

# Check 4: Storage Buckets Configuration
Write-Host "✓ Check 4: Storage Buckets" -ForegroundColor Cyan
try {
    $buckets = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/storage/buckets" `
        -Headers @{
            Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"
        }

    $expectedBuckets = @('audio-recordings', 'word-audio')
    foreach ($expectedBucket in $expectedBuckets) {
        $found = $buckets | Where-Object { $_.name -eq $expectedBucket }
        if ($found) {
            Write-Host "  ✓ Bucket '$expectedBucket' exists (Public: $($found.public))" -ForegroundColor Green

            # Verify buckets are private as per security requirements
            if ($found.public -eq $true) {
                $issuesFound += "Bucket '$expectedBucket' should be PRIVATE for security"
                Write-Host "    ✗ Security Issue: Bucket should be private!" -ForegroundColor Red
            }
        } else {
            $issuesFound += "Missing storage bucket: $expectedBucket"
            Write-Host "  ✗ Missing bucket: $expectedBucket" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ✗ Could not check storage buckets: $_" -ForegroundColor Red
}
Write-Host ""

# Check 5: Required Functions
Write-Host "✓ Check 5: Database Functions" -ForegroundColor Cyan
$query = @"
SELECT
    proname,
    prosecdef
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND proname IN ('handle_new_user', 'fn_add_stars')
ORDER BY proname;
"@
$result = Invoke-SupabaseQuery -Query $query -Description "Required functions"
if ($result) {
    $expectedFunctions = @('handle_new_user', 'fn_add_stars')
    $foundFunctions = $result | ForEach-Object { $_.proname }

    foreach ($expected in $expectedFunctions) {
        if ($expected -notin $foundFunctions) {
            $issuesFound += "Missing required function: $expected"
            Write-Host "  ✗ Missing: $expected" -ForegroundColor Red
        } else {
            $func = $result | Where-Object { $_.proname -eq $expected }
            Write-Host "  ✓ Found: $expected (SECURITY DEFINER: $($func.prosecdef))" -ForegroundColor Green
        }
    }
}
Write-Host ""

# Check 6: Triggers
Write-Host "✓ Check 6: Database Triggers" -ForegroundColor Cyan
$query = @"
SELECT
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;
"@
$result = Invoke-SupabaseQuery -Query $query -Description "Triggers"
if ($result) {
    if ($result.Count -eq 0) {
        $warnings += "No triggers found - verify auth trigger on auth.users"
        Write-Host "  ⚠ No triggers found in public schema" -ForegroundColor Yellow
    } else {
        foreach ($trigger in $result) {
            Write-Host "  ✓ $($trigger.trigger_name) on $($trigger.event_object_table)" -ForegroundColor Green
        }
    }
}
Write-Host ""

# Check 7: Constraints
Write-Host "✓ Check 7: Check Constraints" -ForegroundColor Cyan
$query = @"
SELECT
    tc.table_name,
    cc.check_clause,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name;
"@
$result = Invoke-SupabaseQuery -Query $query -Description "Check constraints"
if ($result) {
    foreach ($constraint in $result) {
        Write-Host "  ✓ $($constraint.table_name): $($constraint.constraint_name)" -ForegroundColor Green
    }

    # Verify critical constraints exist
    $profileRoleCheck = $result | Where-Object { $_.table_name -eq 'profiles' -and $_.check_clause -like '*role*' }
    if (-not $profileRoleCheck) {
        $warnings += "Missing role constraint on profiles table"
        Write-Host "  ⚠ profiles table should have role constraint (parent/child)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Check 8: Column Defaults
Write-Host "✓ Check 8: Important Column Defaults" -ForegroundColor Cyan
$query = @"
SELECT
    table_name,
    column_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_default IS NOT NULL
    AND (
        column_name LIKE '%_at'
        OR column_name = 'id'
        OR column_name LIKE '%ease%'
        OR column_name LIKE '%interval%'
    )
ORDER BY table_name, column_name;
"@
$result = Invoke-SupabaseQuery -Query $query -Description "Column defaults"
if ($result) {
    foreach ($col in $result) {
        Write-Host "  ✓ $($col.table_name).$($col.column_name): $($col.column_default)" -ForegroundColor Green
    }
}
Write-Host ""

# Summary
Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Yellow
Write-Host ""

if ($issuesFound.Count -eq 0) {
    Write-Host "✓ No critical issues found!" -ForegroundColor Green
} else {
    Write-Host "✗ CRITICAL ISSUES ($($issuesFound.Count)):" -ForegroundColor Red
    foreach ($issue in $issuesFound) {
        Write-Host "  • $issue" -ForegroundColor Red
    }
}

Write-Host ""

if ($warnings.Count -eq 0) {
    Write-Host "✓ No warnings!" -ForegroundColor Green
} else {
    Write-Host "⚠ WARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== ADVISOR COMPLETE ===" -ForegroundColor Green
