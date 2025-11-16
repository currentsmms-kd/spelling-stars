$projectRef = "tucdqibvxioxbeyrbsef"
$accessToken = doppler secrets get SUPABASE_ACCESS_TOKEN --plain

$records = @(
    @{ version = '20241108000000'; name = 'initial_schema' },
    @{ version = '20241108000003'; name = 'safe_schema_update' },
    @{ version = '20241108000004'; name = 'safe_seed_data' },
    @{ version = '20241109000001'; name = 'add_word_audio_bucket' },
    @{ version = '20241109000002'; name = 'fix_profile_rls' },
    @{ version = '20241109000003'; name = 'simplify_profile_rls' },
    @{ version = '20241109000004'; name = 'add_srs_table' },
    @{ version = '20241109000005'; name = 'add_parental_controls_analytics_badges' },
    @{ version = '20241109000006'; name = 'add_color_theme' },
    @{ version = '20251109164346'; name = 'document_audio_url_security' },
    @{ version = '20251109180000'; name = 'add_performance_indexes' },
    @{ version = '20251109190000'; name = 'fix_function_search_path' },
    @{ version = '20251109170000'; name = 'secure_prompt_audio_private' },
    @{ version = '20251109215344'; name = 'add_parent_analytics_views' },
    @{ version = '20251109200000'; name = 'optimize_rls_policies' },
    @{ version = '20251109210000'; name = 'fix_multiple_permissive_policies' },
    @{ version = '20251109235400'; name = 'add_d3_srs_features' },
    @{ version = '20251109225900'; name = 'add_parent_child_relationship' },
    @{ version = '20251109235500'; name = 'add_d4_rewards_shop' },
    @{ version = '20251110000000'; name = 'fix_child_profile_creation' },
    @{ version = '20251110214233'; name = 'add_list_id_to_attempts' },
    @{ version = '20251111000000'; name = 'drop_unused_srs_indexes' },
    @{ version = '20251111000001'; name = 'fix_attempts_duplicate_policies' },
    @{ version = '20251111000002'; name = 'populate_list_words' },
    @{ version = '20251112232115'; name = 'add_ignore_punctuation_setting' },
    @{ version = '20251113000000'; name = 'add_child_profile_fields' },
    @{ version = '20251113224720'; name = 'add_auto_advance_delay_setting' },
    @{ version = '20251114000000'; name = 'add_word_search_results' },
    @{ version = '20251114000001'; name = 'simplify_attempts_insert_policy' },
    @{ version = '20251115000000'; name = 'restore_word_lists_select_policy' },
    @{ version = '20251115000001'; name = 'fix_child_game_rls_policies' },
    @{ version = '20251115120000'; name = 'add_attempts_list_id_index' }
)

$valuesString = ($records | ForEach-Object {
    "('{0}','{1}','{{""Backfilled""}}')" -f $_.version, $_.name
}) -join ",`n    "

$query = @"
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
    $valuesString
ON CONFLICT (version) DO NOTHING;
"@

$body = @{ query = $query } | ConvertTo-Json

try {
    Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "Content-Type" = "application/json"
        } `
        -Body $body | Out-Null
    Write-Host "Backfilled migration records" -ForegroundColor Green
}
catch {
    Write-Host "Error backfilling migrations: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
}
