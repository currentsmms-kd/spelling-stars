$projectRef = "mxgamemjvrcajwhbefvz"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

# Check column structure of key tables
$query = @"
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'word_lists', 'words', 'list_words', 'attempts', 'rewards')
ORDER BY table_name, ordinal_position;
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

    Write-Host "Current table structures:" -ForegroundColor Cyan
    $response | Format-Table -AutoSize
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $errorDetails = $_.ErrorDetails.Message
    if ($errorDetails) {
        Write-Host "Error details: $errorDetails" -ForegroundColor Yellow
    }
}
