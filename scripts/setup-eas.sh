#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# TruckinFox — one-time EAS setup
# Run this once before your first eas build.
# Requires: npm i -g eas-cli  and  eas login
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# 1. Link this repo to your EAS project.
#    This writes the real projectId into app.json automatically.
echo ">>> Linking to EAS project..."
eas init --id "$(eas project:info --json 2>/dev/null | jq -r '.id' 2>/dev/null || echo '')"

# ─── Supabase secrets ────────────────────────────────────────────
# Copy from: Supabase Dashboard → Project Settings → API
read -rp "EXPO_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -rp "EXPO_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL     --value "$SUPABASE_URL"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$SUPABASE_ANON_KEY"

# ─── Google Maps secrets ─────────────────────────────────────────
# Create keys at: console.cloud.google.com
# Required APIs: Maps SDK for iOS, Maps SDK for Android, Places API
read -rp "GOOGLE_MAPS_IOS_KEY: "     MAPS_IOS
read -rp "GOOGLE_MAPS_ANDROID_KEY: " MAPS_ANDROID

eas secret:create --scope project --name GOOGLE_MAPS_IOS_KEY     --value "$MAPS_IOS"
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_KEY --value "$MAPS_ANDROID"

echo ""
echo "✓ EAS secrets registered. Run 'eas secret:list' to verify."
echo "✓ Now run: eas build --platform all --profile production"
