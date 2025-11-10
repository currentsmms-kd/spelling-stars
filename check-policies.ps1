# Check RLS Policies
# Queries current RLS policies to verify optimization

# Ensure we're using Doppler for environment variables
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "Error: SUPABASE_ACCESS_TOKEN not found. Please run with Doppler:" -ForegroundColor Red
    Write-Host "doppler run -- pwsh .\check-policies.ps1" -ForegroundColor Yellow
    exit 1
}

$projectRef = $env:VITE_SUPABASE_URL -replace 'https://([^.]+)\.supabase\.co', '$1'
$apiUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"
$accessToken = $env:SUPABASE_ACCESS_TOKEN

$query = @"
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'word_lists', 'words', 'list_words', 'attempts', 'rewards', 'srs', 'parental_settings', 'session_analytics', 'user_badges')
ORDER BY tablename, policyname;
"@

$body = @{
    query = $query
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $body

    Write-Host "`n=== CURRENT RLS POLICIES ===" -ForegroundColor Cyan
    Write-Host ""

    if ($response) {
        $response | Format-Table -Property tablename, policyname, command -AutoSize

        Write-Host "`nTotal policies found: $($response.Count)" -ForegroundColor Green

        # Check for optimized policies (those with "appropriate" in the name)
        $optimizedPolicies = $response | Where-Object { $_.policyname -like "*appropriate*" }
        Write-Host "Optimized consolidated policies: $($optimizedPolicies.Count)" -ForegroundColor Green
    } else {
        Write-Host "No policies found or error in response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error querying policies: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n=== CHECK COMPLETE ===" -ForegroundColor Cyan
