# List Supabase Projects
$ErrorActionPreference = "Stop"

Write-Host "Fetching all Supabase projects..." -ForegroundColor Cyan

$projects = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects' -Headers @{
    Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"
}

Write-Host ""
Write-Host "=== AVAILABLE PROJECTS ===" -ForegroundColor Yellow
Write-Host ""

foreach ($project in $projects.projects) {
    Write-Host "Name: $($project.name)" -ForegroundColor Green
    Write-Host "ID: $($project.id)" -ForegroundColor Cyan
    Write-Host "Region: $($project.region)" -ForegroundColor Gray
    Write-Host ""
}

# Output raw JSON
$projects | ConvertTo-Json -Depth 5
