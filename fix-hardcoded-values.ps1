# Script to replace hard-coded UI/UX values with design system constants
# This script fixes spacing, colors, and fontSize inconsistencies

$ErrorActionPreference = "Continue"
$filesFixed = 0
$totalReplacements = 0

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  UI/UX Consistency Fixer" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Define replacement mappings
$spacingReplacements = @{
    # Padding/Margin replacements
    "paddingHorizontal: 2," = "paddingHorizontal: spacing.xxs,"
    "paddingHorizontal: 4," = "paddingHorizontal: spacing.xxxs,"
    "paddingHorizontal: 5," = "paddingHorizontal: spacing.xxxs,"
    "paddingHorizontal: 6," = "paddingHorizontal: spacing.xxxs,"
    "paddingHorizontal: 8," = "paddingHorizontal: spacing.xs,"
    "padding Horizontal: 10," = "paddingHorizontal: spacing.xs,"
    "paddingHorizontal: 12," = "paddingHorizontal: spacing.sm,"
    "paddingHorizontal: 14," = "paddingHorizontal: spacing.sm,"
    "paddingHorizontal: 16," = "paddingHorizontal: spacing.md,"
    "paddingHorizontal: 20," = "paddingHorizontal: spacing.lg,"
    "paddingHorizontal: 24," = "paddingHorizontal: spacing.xl,"
    "paddingHorizontal: 32," = "paddingHorizontal: spacing.xxl,"
    "paddingHorizontal: 40," = "paddingHorizontal: spacing.xxxl,"
    
    "padding: 2," = "padding: spacing.xxs,"
    "padding: 4," = "padding: spacing.xxxs,"
    "padding: 8," = "padding: spacing.xs,"
    "padding: 12," = "padding: spacing.sm,"
    "padding: 14," = "padding: spacing.sm,"
    "padding: 16," = "padding: spacing.md,"
    "padding: 20," = "padding: spacing.lg,"
    "padding: 24," = "padding: spacing.xl,"
    "padding: 32," = "padding: spacing.xxl,"
    "padding: 40," = "padding: spacing.xxxl,"
    
    "marginTop: 2," = "marginTop: spacing.xxs,"
    "marginTop: 4," = "marginTop: spacing.xxxs,"
    "marginTop: 6," = "marginTop: spacing.xxxs,"
    "marginTop: 7," = "marginTop: spacing.xxxs,"
    "marginTop: 8," = "marginTop: spacing.xs,"
    "marginTop: 10," = "marginTop: spacing.xs,"
    "marginTop: 12," = "marginTop: spacing.sm,"
    "marginTop: 16," = "marginTop: spacing.md,"
    "marginTop: 20," = "marginTop: spacing.lg,"
    "marginTop: 24," = "marginTop: spacing.xl,"
    "marginTop: 32," = "marginTop: spacing.xxl,"
    
    "marginBottom: 2," = "marginBottom: spacing.xxs,"
    "marginBottom: 4," = "marginBottom: spacing.xxxs,"
    "marginBottom: 6," = "marginBottom: spacing.xxxs,"
    "marginBottom: 8," = "marginBottom: spacing.xs,"
    "marginBottom: 10," = "marginBottom: spacing.xs,"
    "marginBottom: 12," = "marginBottom: spacing.sm,"
    "marginBottom: 16," = "marginBottom: spacing.md,"
    "marginBottom: 18," = "marginBottom: spacing.lg,"
    "marginBottom: 20," = "marginBottom: spacing.lg,"
    "marginBottom: 24," = "marginBottom: spacing.xl,"
    "marginBottom: 32," = "marginBottom: spacing.xxl,"
    
    "paddingVertical: 4," = "paddingVertical: spacing.xxxs,"
    "paddingVertical: 6," = "paddingVertical: spacing.xxxs,"
    "paddingVertical: 8," = "paddingVertical: spacing.xs,"
    "paddingVertical: 10," = "paddingVertical: spacing.xs,"
    "paddingVertical: 12," = "paddingVertical: spacing.sm,"
    "paddingVertical: 14," = "paddingVertical: spacing.sm,"
    "paddingVertical: 16," = "paddingVertical: spacing.md,"
    "paddingVertical: 20," = "paddingVertical: spacing.lg,"
    
    "marginHorizontal: 16," = "marginHorizontal: spacing.md,"
    "marginHorizontal: 20," = "marginHorizontal: spacing.lg,"
    "marginHorizontal: 24," = "marginHorizontal: spacing.xl,"
    
    "marginVertical: 16," = "marginVertical: spacing.md,"
    "marginVertical: 20," = "marginVertical: spacing.lg,"
    "marginVertical: 24," = "marginVertical: spacing.xl,"
    
    "borderRadius: 4," = "borderRadius: spacing.xxxs,"
    "borderRadius: 8," = "borderRadius: borderRadius.sm,"
    "borderRadius: 10," = "borderRadius: borderRadius.sm,"
    "borderRadius: 12," = "borderRadius: borderRadius.md,"
    "borderRadius: 16," = "borderRadius: borderRadius.lg,"
    "borderRadius: 20," = "borderRadius: borderRadius.xl,"
    "borderRadius: 24," = "borderRadius: borderRadius.xl,"
}

$colorReplacements = @{
    # Text colors
    "color: '#212121'" = "color: colors.text.primary"
    'color: "#212121"' = "color: colors.text.primary"
    "color: '#616161'" = "color: colors.text.secondary"
    'color: "#616161"' = "color: colors.text.secondary"
    "color: '#9CA3AF'" = "color: colors.text.tertiary"
    'color: "#9CA3AF"' = "color: colors.text.tertiary"
    "color: '#374151'" = "color: colors.text.dark"
    'color: "#374151"' = "color: colors.text.dark"
    
    # Background colors
    "backgroundColor: '#F9FAFB'" = "backgroundColor: colors.backgroundLight"
    'backgroundColor: "#F9FAFB"' = "backgroundColor: colors.backgroundLight"
    "backgroundColor: '#FAFAFA'" = "backgroundColor: colors.backgroundVeryLight"
    'backgroundColor: "#FAFAFA"' = "backgroundColor: colors.backgroundVeryLight"
    "backgroundColor: '#FFFFFF'" = "backgroundColor: colors.white"
    'backgroundColor: "#FFFFFF"' = "backgroundColor: colors.white"
    "backgroundColor: 'white'" = "backgroundColor: colors.white"
    
    # Border colors
    "borderColor: '#E5E7EB'" = "borderColor: colors.border.default"
    'borderColor: "#E5E7EB"' = "borderColor: colors.border.default"
    "borderColor: '#F3F4F6'" = "borderColor: colors.border.light"
    'borderColor: "#F3F4F6"' = "borderColor: colors.border.light"
    "borderColor: '#D1D5DB'" = "borderColor: colors.border.medium"
    'borderColor: "#D1D5DB"' = "borderColor: colors.border.medium"
    "borderBottomColor: '#E5E7EB'" = "borderBottomColor: colors.border.default"
    'borderBottomColor: "#E5E7EB"' = "borderBottomColor: colors.border.default"
    "borderTopColor: '#E5E7EB'" = "borderTopColor: colors.border.default"
    'borderTopColor: "#E5E7EB"' = "borderTopColor: colors.border.default"
    
    # Primary color
    "backgroundColor: '#FF7043'" = "backgroundColor: colors.primary"
    'backgroundColor: "#FF7043"' = "backgroundColor: colors.primary"
    "color: '#FF7043'" = "color: colors.primary"
    'color: "#FF7043"' = "color: colors.primary"
    "borderColor: '#FF7043'" = "borderColor: colors.primary"
    'borderColor: "#FF7043"' = "borderColor: colors.primary"
    "shadowColor: '#FF7043'" = "shadowColor: colors.primary"
    'shadowColor: "#FF7043"' = "shadowColor: colors.primary"
    
    # Status colors  
    "backgroundColor: '#10B981'" = "backgroundColor: colors.success"
    'backgroundColor: "#10B981"' = "backgroundColor: colors.success"
    "color: '#10B981'" = "color: colors.success"
    'color: "#10B981"' = "color: colors.success"
    "shadowColor: '#10B981'" = "shadowColor: colors.success"
    'shadowColor: "#10B981"' = "shadowColor: colors.success"
    
    "backgroundColor: '#EF4444'" = "backgroundColor: colors.error"
    'backgroundColor: "#EF4444"' = "backgroundColor: colors.error"
    "color: '#EF4444'" = "color: colors.error"
    'color: "#EF4444"' = "color: colors.error"
    "shadowColor: '#EF4444'" = "shadowColor: colors.error"
    'shadowColor: "#EF4444"' = "shadowColor: colors.error"
    
    # Black/white
    "shadowColor: '#000'" = "shadowColor: colors.black"
    'shadowColor: "#000"' = "shadowColor: colors.black"
    "shadowColor: '#000000'" = "shadowColor: colors.black"
    'shadowColor: "#000000"' = "shadowColor: colors.black"
}

$fontSizeReplacements = @{
    "fontSize: 9," = "fontSize: fontSize.xs,"
    "fontSize: 10," = "fontSize: fontSize.xs,"
    "fontSize: 11," = "fontSize: fontSize.xs,"
    "fontSize: 12," = "fontSize: fontSize.sm,"
    "fontSize: 13," = "fontSize: fontSize.sm,"
    "fontSize: 14," = "fontSize: fontSize.sm,"
    "fontSize: 15," = "fontSize: fontSize.md,"
    "fontSize: 16," = "fontSize: fontSize.md,"
    "fontSize: 17," = "fontSize: fontSize.lg,"
    "fontSize: 18," = "fontSize: fontSize.lg,"
    "fontSize: 19," = "fontSize: fontSize.lg,"
    "fontSize: 20," = "fontSize: fontSize.xl,"
    "fontSize: 24," = "fontSize: fontSize.xxl,"
    "fontSize: 28," = "fontSize: fontSize.xxxl,"
    "fontSize: 34," = "fontSize: fontSize.huge,"
    "fontSize: 44," = "fontSize: fontSize.huge,"
}

# Get all TSX files in app and components folder
$files = Get-ChildItem -Path "app","components" -Recurse -Filter "*.tsx" -File

foreach ($file in $files) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
        $originalContent = $content
        $fileReplacements = 0
        
        # Apply spacing replacements
        foreach ($pattern in $spacingReplacements.Keys) {
            $replacement = $spacingReplacements[$pattern]
            if ($content -match [regex]::Escape($pattern)) {
                $content = $content -replace [regex]::Escape($pattern), $replacement
                $fileReplacements++
            }
        }
        
        # Apply color replacements
        foreach ($pattern in $colorReplacements.Keys) {
            $replacement = $colorReplacements[$pattern]
            if ($content -match [regex]::Escape($pattern)) {
                $content = $content -replace [regex]::Escape($pattern), $replacement
                $fileReplacements++
            }
        }
        
        # Apply fontSize replacements
        foreach ($pattern in $fontSizeReplacements.Keys) {
            $replacement = $fontSizeReplacements[$pattern]
            if ($content -match [regex]::Escape($pattern)) {
                $content = $content -replace [regex]::Escape($pattern), $replacement
                $fileReplacements++
            }
        }
        
        # Only save if content changed
        if ($content -ne $originalContent) {
            # Ensure imports are present if we made replacements
            if ($fileReplacements -gt 0) {
                if ($content -notmatch "import.*from.*sharedStyles") {
                    # Find the last import statement
                    $lines = $content -split "`n"
                    $lastImportIndex = -1
                    for ($i = 0; $i -lt $lines.Count; $i++) {
                        if ($lines[$i] -match "^import ") {
                            $lastImportIndex = $i
                        }
                    }
                    
                    # Insert import after last import
                    if ($lastImportIndex -ge 0) {
                        $importLine = "import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';"
                        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
                        $depth = ($relativePath -split "\\").Count - 2
                        $prefix = ("..\" * $depth) -replace "\\$", ""
                        $importLine = "import { colors, spacing, fontSize, fontWeight, borderRadius } from '$prefix/lib/sharedStyles';"
                        
                        $lines = @($lines[0..$lastImportIndex], $importLine, $lines[($lastImportIndex + 1)..($lines.Count - 1)])
                        $content = $lines -join "`n"
                    }
                }
            }
            
            Set-Content -Path $file.FullName -Value $content -ErrorAction Stop
            $filesFixed++
            $totalReplacements += $fileReplacements
            Write-Host "✓ Fixed: $($file.Name) ($fileReplacements replacements)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "✗ Error processing $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files fixed:         $filesFixed" -ForegroundColor Green
Write-Host "Total replacements:  $totalReplacements" -ForegroundColor Green
Write-Host "`n✓  UI/UX consistency improvements complete!`n" -ForegroundColor Green
