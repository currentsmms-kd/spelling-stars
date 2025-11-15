#!/usr/bin/env pwsh
# Check profiles and their roles

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" -ForegroundColor Red
    Write-Host "Please run with Doppler:" -ForegroundColor Yellow
    Write-Host "doppler run -- pwsh .\check-profiles-roles.ps1" -ForegroundColor Cyan
    exit 1
}

Write-Host "`n=== CHECKING PROFILES AND ROLES ===" -ForegroundColor Cyan
Write-Host ""

$url = "$env:SUPABASE_URL/rest/v1/profiles?select=id,email,role,display_name,parent_id&order=created_at.desc&limit=20"
$headers = @{
    'apikey' = $env:SUPABASE_SERVICE_ROLE_KEY
    'Authorization' = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
    'Content-Type' = 'application/json'
}

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

    if ($response.Count -eq 0) {
        Write-Host "No profiles found in database." -ForegroundColor Yellow
    } else {
        Write-Host "Found $($response.Count) profile(s):" -ForegroundColor Green
        Write-Host ""
        $response | Format-Table -Property id, role, display_name, email, parent_id -AutoSize

        # Count by role
        $roleCount = $response | Group-Object -Property role | Select-Object Name, Count
        Write-Host "`nRole distribution:" -ForegroundColor Cyan
        $roleCount | Format-Table -AutoSize
    }
} catch {
    Write-Host "Error querying profiles:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`n=== CHECK COMPLETE ===" -ForegroundColor Green
