# Check Supabase Database Advisors
# This script fetches and displays database advisor recommendations

$ErrorActionPreference = "Stop"

Write-Host "Fetching Supabase project information..." -ForegroundColor Cyan

# Get project reference
# Use the known project ID
$projectRef = "mxgamemjvrcajwhbefvz"
Write-Host "Project ID: $projectRef" -ForegroundColor Green
Write-Host "Project Name: spelling-stars" -ForegroundColor Green
Write-Host ""

Write-Host "Fetching database advisors..." -ForegroundColor Cyan

# Get advisors
$advisors = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectRef/database/advisors" -Headers @{
    Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"
}

# Display advisors
Write-Host ""
Write-Host "=== DATABASE ADVISORS ===" -ForegroundColor Yellow
Write-Host ""

if ($advisors.Count -eq 0) {
    Write-Host "No advisors found or no issues detected!" -ForegroundColor Green
} else {
    foreach ($advisor in $advisors) {
        $severity = $advisor.severity
        $color = switch ($severity) {
            "ERROR" { "Red" }
            "WARNING" { "Yellow" }
            "INFO" { "Cyan" }
            default { "White" }
        }

        Write-Host "[$severity] $($advisor.name)" -ForegroundColor $color
        Write-Host "Description: $($advisor.description)" -ForegroundColor Gray
        if ($advisor.recommendation) {
            Write-Host "Recommendation: $($advisor.recommendation)" -ForegroundColor Gray
        }
        if ($advisor.details) {
            Write-Host "Details:" -ForegroundColor Gray
            $advisor.details | ConvertTo-Json -Depth 5 | Write-Host
        }
        Write-Host ""
    }
}

# Output raw JSON for analysis
Write-Host ""
Write-Host "=== RAW JSON ===" -ForegroundColor Yellow
$advisors | ConvertTo-Json -Depth 10
