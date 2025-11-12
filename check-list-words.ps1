# Check if list_words entries exist
$projectRef = $env:VITE_SUPABASE_URL -replace 'https://', '' -replace '\.supabase\.co', ''
$token = $env:SUPABASE_ACCESS_TOKEN
$anonKey = $env:VITE_SUPABASE_ANON_KEY

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
    'apikey' = $anonKey
}

Write-Host "`n=== WORD LISTS ===" -ForegroundColor Cyan
$wordListsUrl = "https://$projectRef.supabase.co/rest/v1/word_lists?select=id,title"
$lists = Invoke-RestMethod -Uri $wordListsUrl -Headers $headers -Method Get
$lists | Format-Table id, title

if ($lists.Count -gt 0) {
    $firstListId = $lists[0].id

    Write-Host "`n=== LIST_WORDS FOR FIRST LIST ($firstListId) ===" -ForegroundColor Cyan
    $listWordsUrl = "https://$projectRef.supabase.co/rest/v1/list_words?select=*&list_id=eq.$firstListId"
    $listWords = Invoke-RestMethod -Uri $listWordsUrl -Headers $headers -Method Get
    $listWords | Format-Table list_id, word_id, sort_index

    Write-Host "`nTotal list_words entries: $($listWords.Count)" -ForegroundColor Yellow
}

Write-Host "`n=== ALL LIST_WORDS ===" -ForegroundColor Cyan
$allListWordsUrl = "https://$projectRef.supabase.co/rest/v1/list_words?select=*"
$allListWords = Invoke-RestMethod -Uri $allListWordsUrl -Headers $headers -Method Get
Write-Host "Total list_words entries in database: $($allListWords.Count)" -ForegroundColor Yellow
