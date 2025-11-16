param(
    [Parameter(Mandatory=$true)]
    [string]$File
)

$projectRef = "tucdqibvxioxbeyrbsef"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain
$query = Get-Content $File -Raw
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
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
}
