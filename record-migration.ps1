$projectRef = "mxgamemjvrcajwhbefvz"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

# Read the migration file to get the statements
$migrationFile = ".\supabase\migrations\20241108000003_safe_schema_update.sql"
$migrationSQL = Get-Content $migrationFile -Raw

# Insert the migration record
$query = @"
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20241108000003', 'safe_schema_update', ARRAY['-- Migration was already applied manually']::text[])
ON CONFLICT (version) DO NOTHING;
"@

$body = @{
    query = $query
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✓ Migration record added successfully!" -ForegroundColor Green
    Write-Host "`nVerifying migrations..." -ForegroundColor Cyan

    # Verify
    $verifyQuery = "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;"
    $verifyBody = @{ query = $verifyQuery } | ConvertTo-Json

    $verifyResponse = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json"
        } `
        -Body $verifyBody

    $verifyResponse | Format-Table -AutoSize
}
catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    $errorDetails = $_.ErrorDetails.Message
    if ($errorDetails) {
        Write-Host "Error details: $errorDetails" -ForegroundColor Yellow
    }
}
