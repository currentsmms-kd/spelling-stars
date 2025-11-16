$projectRef = "tucdqibvxioxbeyrbsef"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

$query = @"
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname IN ('storage','auth')
  AND tablename IN ('objects','users');
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

    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
}
