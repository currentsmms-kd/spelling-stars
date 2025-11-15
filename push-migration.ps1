# Push Supabase migrations using Management API
$projectRef = "tucdqibvxioxbeyrbsef"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

# Read all migration files
$migrations = Get-ChildItem -Path ".\supabase\migrations" -Filter "*.sql" | Sort-Object Name

foreach ($migration in $migrations) {
    Write-Host "Applying migration: $($migration.Name)" -ForegroundColor Cyan

    $sql = Get-Content $migration.FullName -Raw

    # Use Supabase Management API to run SQL
    $body = @{
        query = $sql
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

        Write-Host "✓ Successfully applied $($migration.Name)" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Error applying $($migration.Name): $($_.Exception.Message)" -ForegroundColor Red
        $errorDetails = $_.ErrorDetails.Message
        if ($errorDetails) {
            Write-Host "Error details: $errorDetails" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nAll migrations processed!" -ForegroundColor Green
