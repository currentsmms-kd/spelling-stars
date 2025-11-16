$projectRef = "tucdqibvxioxbeyrbsef"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

$query = @"
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    name text NOT NULL,
    statements text[] DEFAULT ARRAY[]::text[],
    run_at timestamptz NOT NULL DEFAULT now()
);
"@

$body = @{ query = $query } | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "Initialized supabase_migrations.schema_migrations" -ForegroundColor Green
}
catch {
    Write-Host "Error initializing migration tracking table: $($_.Exception.Message)" -ForegroundColor Red
    $errorDetails = $_.ErrorDetails.Message
    if ($errorDetails) {
        Write-Host "Error details: $errorDetails" -ForegroundColor Yellow
    }
}
