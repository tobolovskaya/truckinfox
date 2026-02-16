# Fix UI/UX values in bracket-named files
$ErrorActionPreference = "Continue"

$files = @(
    "app\chat\[requestId]\[userId].tsx",
    "app\edit-request\[id].tsx",
    "app\order-status\[orderId].tsx",
    "app\payment\[orderId].tsx",
    "app\profile\[userId].tsx",
    "app\request-details\[id].tsx",
    "app\request-edit\[id].tsx",
    "app\review\[orderId].tsx"
)

$spacingMap = @{
    'paddingHorizontal:\s*2,|padding:\s*2,' = 'spacing.xxs'
    'paddingHorizontal:\s*4,|padding:\s*4,' = 'spacing.xxxs'
    'paddingHorizontal:\s*8,|padding:\s*8,' = 'spacing.xs'
    'paddingHorizontal:\s*10,' = 'spacing.xs'
    'paddingHorizontal:\s*12,|padding:\s*12,' = 'spacing.sm'
    'paddingHorizontal:\s*14,|padding:\s*14,' = 'spacing.sm'
    'paddingHorizontal:\s*16,|padding:\s*16,' = 'spacing.md'
    'paddingHorizontal:\s*20,|padding:\s*20,' = 'spacing.lg'
    'paddingHorizontal:\s*24,|padding:\s*24,' = 'spacing.xl'
    'paddingHorizontal:\s*32,|padding:\s*32,' = 'spacing.xxl'
    'paddingHorizontal:\s*40,|padding:\s*40,' = 'spacing.xxxl'
    'paddingHorizontal:\s*48,' = 'spacing.huge'
    'marginTop:\s*2,|marginBottom:\s*2,' = 'spacing.xxs'
    'marginTop:\s*4,|marginBottom:\s*4,' = 'spacing.xxxs'
    'marginTop:\s*8,|marginBottom:\s*8,' = 'spacing.xs'
    'marginTop:\s*10,|marginBottom:\s*10,' = 'spacing.xs'
    'marginTop:\s*12,|marginBottom:\s*12,|paddingVertical:\s*12,' = 'spacing.sm'
    'marginTop:\s*16,|marginBottom:\s*16,|paddingVertical:\s*16,|marginHorizontal:\s*16,' = 'spacing.md'
    'marginTop:\s*20,|marginBottom:\s*20,|paddingVertical:\s*20,|marginHorizontal:\s*20,' = 'spacing.lg'
    'marginTop:\s*24,|marginBottom:\s*24,|paddingVertical:\s*24,|marginHorizontal:\s*24,' = 'spacing.xl'
    'marginTop:\s*32,|marginBottom:\s*32,|paddingVertical:\s*32,|marginHorizontal:\s*32,' = 'spacing.xxl'
}

$colorMap = @{
    'color:\s*#212121' = 'colors.text.primary'
    'color:\s*#616161' = 'colors.text.secondary'
    'color:\s*#9CA3AF' = 'colors.text.tertiary'
    'color:\s*#374151' = 'colors.text.dark'
    'backgroundColor:\s*#F9FAFB' = 'colors.backgroundLight'
    'backgroundColor:\s*#FAFAFA' = 'colors.backgroundVeryLight'
    'backgroundColor:\s*#FFFFFF' = 'colors.white'
    "backgroundColor:\s*'white'" = 'colors.white'
    'borderColor:\s*#E5E7EB' = 'colors.border.default'
    'borderBottomColor:\s*#E5E7EB' = 'colors.border.default'
    'borderTopColor:\s*#E5E7EB' = 'colors.border.default'
    'borderColor:\s*#F3F4F6' = 'colors.border.light'
    'borderBottomColor:\s*#F3F4F6' = 'colors.border.light'
    'borderColor:\s*#D1D5DB' = 'colors.border.medium'
    'backgroundColor:\s*#FF7043' = 'colors.primary'
    'color:\s*#FF7043' = 'colors.primary'
    'borderColor:\s*#FF7043' = 'colors.primary'
    'shadowColor:\s*#FF7043' = 'colors.primary'
    'backgroundColor:\s*#10B981' = 'colors.success'
    'color:\s*#10B981' = 'colors.success'
    'shadowColor:\s*#10B981' = 'colors.success'
    'backgroundColor:\s*#EF4444' = 'colors.error'
    'color:\s*#EF4444' = 'colors.error'
    'shadowColor:\s*#EF4444' = 'colors.error'
    'shadowColor:\s*#000' = 'colors.black'
    'shadowColor:\s*#000000' = 'colors.black'
}

$fontSizeMap = @{
    'fontSize:\s*9,|fontSize:\s*10,|fontSize:\s*11,' = 'fontSize.xs'
    'fontSize:\s*12,|fontSize:\s*13,|fontSize:\s*14,' = 'fontSize.sm'
    'fontSize:\s*15,|fontSize:\s*16,' = 'fontSize.md'
    'fontSize:\s*17,|fontSize:\s*18,|fontSize:\s*19,' = 'fontSize.lg'
    'fontSize:\s*20,' = 'fontSize.xl'
    'fontSize:\s*24,' = 'fontSize.xxl'
    'fontSize:\s*28,' = 'fontSize.xxxl'
    'fontSize:\s*34,|fontSize:\s*44,' = 'fontSize.huge'
}

Write-Host "`n===== Fixing bracket-named files =====" -ForegroundColor Cyan

foreach  ($filePath in $files) {
    if (Test-Path -LiteralPath $filePath) {
        try {
            $content = [System.IO.File]::ReadAllText($filePath)
            $original = $content
            $count = 0
            
            # Replace spacing
            foreach ($pattern in $spacingMap.Keys) {
                $value = $spacingMap[$pattern]
                if ($content -match $pattern) {
                    $content = $content -replace $pattern, $value
                    $count++
                }
            }
            
            # Replace colors
            foreach ($pattern in $colorMap.Keys) {
                $value = $colorMap[$pattern]
                if ($content -match $pattern) {
                    $content = $content -replace $pattern, $value
                    $count++
                }
            }
            
            # Replace fontSize
            foreach ($pattern in $fontSizeMap.Keys) {
                $value = $fontSizeMap[$pattern]
                if ($content -match $pattern) {
                    $content = $content -replace $pattern, $value
                    $count++
                }
            }
            
            if ($content -ne $original) {
                [System.IO.File]::WriteAllText($filePath, $content)
                Write-Host "✓ Fixed: $filePath ($count replacements)" -ForegroundColor Green
            } else {
                Write-Host "- No changes: $filePath" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "✗ Error: $filePath - $_" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "`n✓ Bracket files processed`n" -ForegroundColor Green
