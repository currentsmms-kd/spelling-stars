# Push Supabase migrations using Management API
$projectRef = "tucdqibvxioxbeyrbsef"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

# Helper function to execute SQL query
function Invoke-SupabaseQuery {
    param(
        [string]$Query,
        [string]$ProjectRef,
        [string]$AccessToken
    )

    $body = @{ query = $Query } | ConvertTo-Json

    return Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $AccessToken"
            "Content-Type" = "application/json"
        } `
        -Body $body
}

# Get list of already applied migrations
Write-Host "Checking applied migrations..." -ForegroundColor Cyan
$appliedMigrations = @()

try {
    $checkQuery = "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
    $response = Invoke-SupabaseQuery -Query $checkQuery -ProjectRef $projectRef -AccessToken $accessToken

    if ($response -and $response.Count -gt 0) {
        $appliedMigrations = $response | ForEach-Object { $_.version }
        Write-Host "Found $($appliedMigrations.Count) applied migrations" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠ Could not fetch applied migrations (table may not exist yet)" -ForegroundColor Yellow
}

# Read all migration files
$migrations = Get-ChildItem -Path ".\supabase\migrations" -Filter "*.sql" | Sort-Object Name
$skipped = 0
$applied = 0
$failed = 0

foreach ($migration in $migrations) {
    # Extract version from filename (format: YYYYMMDDHHMMSS_description.sql)
    $version = $migration.Name -replace '_.*', ''

    # Skip if already applied
    if ($appliedMigrations -contains $version) {
        Write-Host "⊘ Skipping $($migration.Name) (already applied)" -ForegroundColor Gray
        $skipped++
        continue
    }

    Write-Host "Applying migration: $($migration.Name)" -ForegroundColor Cyan

    $sql = Get-Content $migration.FullName -Raw

    try {
        # Apply the migration
        $response = Invoke-SupabaseQuery -Query $sql -ProjectRef $projectRef -AccessToken $accessToken

        # Record the migration in tracking table
        $migrationName = $migration.Name -replace '^\d+_', '' -replace '\.sql$', ''
        $recordQuery = @"
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('$version', '$migrationName', ARRAY['Applied via push-migration.ps1']::text[])
ON CONFLICT (version) DO NOTHING;
"@

        try {
            Invoke-SupabaseQuery -Query $recordQuery -ProjectRef $projectRef -AccessToken $accessToken | Out-Null
        }
        catch {
            Write-Host "  ⚠ Migration applied but could not record in tracking table" -ForegroundColor Yellow
        }

        Write-Host "✓ Successfully applied $($migration.Name)" -ForegroundColor Green
        $applied++
    }
    catch {
        Write-Host "✗ Error applying $($migration.Name): $($_.Exception.Message)" -ForegroundColor Red
        $errorDetails = $_.ErrorDetails.Message
        if ($errorDetails) {
            Write-Host "  Error details: $errorDetails" -ForegroundColor Yellow
        }
        $failed++
    }
}

Write-Host "`n=== Migration Summary ===" -ForegroundColor Cyan
Write-Host "Applied: $applied" -ForegroundColor Green
Write-Host "Skipped: $skipped" -ForegroundColor Gray
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Total: $($migrations.Count)" -ForegroundColor White
