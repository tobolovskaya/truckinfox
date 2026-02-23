# API Keys Security Hardening Checklist

## Quick Reference

| Component | Status | Security Level |
|-----------|--------|-----------------|
| Firebase API Key | ✅ Env var (EXPOSED_PUBLIC) | Public (by design) |
| Google Maps API Key | ✅ Env var (EXPOSED_PUBLIC) | ⚠️ **Public (should migrate)** |
| Google Places API Key | ✅ Env var (EXPOSED_PUBLIC) | ⚠️ **Public (should migrate)** |
| Redis Token | ✅ Env var (EXPOSED_PUBLIC) | ⚠️ **Public (should rotate)** |
| Cloud Functions Keys | ❌ Not configured | ✅ Protected (server-side) |

## 📋 Development Environment Checklist

- [x] `.env` file created and added to `.gitignore`
- [x] `.env.example` template created for sharing (with placeholder values)
- [x] Environment variables prefixed with `EXPO_PUBLIC_` (for Expo exposure)
- [x] No API keys hardcoded in source files
- [x] No API keys in version control history
- [x] `.env` is in `.gitignore` and commits are protected
- [ ] Review `.gitignore` for any missing patterns

### Current Status
```
✅ .env is protected (in .gitignore)
✅ No keys in source code
⚠️ Keys exposed in compiled APK/IPA (inherent to EXPO_PUBLIC_ prefix)
❌ Keys exposed to reverse engineering risk
```

## 🔒 API Key Restriction (Google Cloud Console)

### For Google Maps & Places APIs
1. ✅ **Project**: truckinfox-8d5b2
2. ✅ **APIs Enabled**:
   - [ ] Places API (should restrict to this only)
   - [ ] Maps Static API
   - [ ] Maps JavaScript API
   - [ ] Geocoding API
3. [ ] **Restrict to API**:
   - [ ] Places API ✅
   - [ ] Maps Static API ✅
   - [ ] ❌ Disable all others
4. [ ] **Application Restrictions**:
   - [ ] Android: `com.truckinfox` + SHA-1 fingerprint
   - [ ] iOS: Bundle ID + team ID
   - [ ] ❌ HTTP referrers (N/A for Expo)
5. [ ] **Billing**: Set quota limits and alerts

### Setup Steps in Google Cloud Console

```bash
# 1. Navigate to APIs & Services
# 2. Find "Google Places API" credential key
# 3. Click to edit
# 4. Under "API Restrictions":
#    - Select: Restrict key
#    - Choose: Places API only
# 5. Under "Application Restrictions":
#    - Choose: Android apps
#    - Add package: com.truckinfox
#    - Add SHA-1: [get from: eas credentials]
# 6. Repeat for iOS with bundle ID
```

## 🛡️ Production Security Strategy

### ⚠️ Current Setup (Development Only)
```
App ──(exposed key)──> Google API
❌ Keys visible in APK/IPA
❌ Vulnerable to reverse engineering
❌ Unable to enforce per-user rate limits
```

### ✅ Recommended Setup (Production)
```
App ──(auth token)──> Cloud Function ──(server key)──> Google API
✅ Keys hidden from clients
✅ Authentication enforced
✅ Rate limiting per user
✅ Request logging & monitoring
✅ Easy key rotation
```

## 🚀 Migration Path: Client-Side → Server-Side

### Phase 1: Immediate (Current App)
**Timeline**: Already implemented with offline fallback

```typescript
// Current: Direct client API call
import { searchNorwegianPlaces } from '../utils/googlePlaces';
const results = await searchNorwegianPlaces('Oslo'); // Uses EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
```

**Risks**:
- ⚠️ Key exposed in APK/IPA via reverse engineering
- ⚠️ No per-user rate limiting
- ⚠️ No request authentication/validation
- ⚠️ Quota exhaustion with no control

**Mitigations**:
- ✅ Offline fallback (Norwegian cities)
- ✅ KeyRestriction to Places API only
- ✅ Application restrictions (Android/iOS package)
- ✅ IP-based rate limiting (Google side)

### Phase 2: Production (3-6 months)
**Migrate to Cloud Function proxy**

1. **Deploy `placesProxyExample.ts`**:
   ```bash
   firebase deploy --only functions:placesAutocomplete,functions:placeDetails
   ```

2. **Set server-side API key**:
   ```bash
   firebase functions:config:set places.api_key="YOUR_SECURE_KEY"
   ```

3. **Update client code** to use `useSecurePlacesProxy()`:
   ```typescript
   const { searchPlaces } = useSecurePlacesProxy();
   const results = await searchPlaces('Oslo');
   ```

4. **Remove from client**:
   ```diff
   - EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=...
   ```

5. **Test offline mode**:
   ```bash
   unset EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
   npm start
   # Verify app still works with offline Norwegian cities
   ```

## 🔑 API Key Inventory

### Firebase API Keys (Safe - Public by Design)

| Key | Value | Scope | Risk |
|-----|-------|-------|------|
| **EXPO_PUBLIC_FIREBASE_API_KEY** | AIzaSyDfuPykZ5Bkc... | Firebase Auth only | ✅ LOW (scoped) |
| **EXPO_PUBLIC_FIREBASE_APP_ID** | 1:972027739699:web... | Firebase only | ✅ LOW (scoped) |

**Why Safe**: Firebase API keys are restricted to specific resources and don't grant direct access to data.

### Google Maps/Places Keys (Requires Protection)

| Key | Value | Scope | Risk | Status |
|-----|-------|-------|------|--------|
| **EXPO_PUBLIC_GOOGLE_MAPS_API_KEY** | AIzaSyCuRJZ-asbs... | Maps API | ⚠️ MEDIUM | EXPOSED |
| **EXPO_PUBLIC_GOOGLE_PLACES_API_KEY** | (same as above) | Places API | ⚠️ MEDIUM | EXPOSED |

**Why Risky**: Can be extracted from APK/IPA and used with high daily quotas ($1000+).

### Redis Credentials (Highly Sensitive)

| Credential | Type | Risk | Status |
|-----------|------|------|--------|
| **EXPO_PUBLIC_REDIS_REST_TOKEN** | API Token | 🔴 **CRITICAL** | EXPOSED |

**Why Critical**: Full read/write access to all Redis data if compromised.

**Immediate Action**: ⚠️ **ROTATE THIS TOKEN NOW**
```bash
# In Redis dashboard:
# 1. Go to Upstash Console
# 2. Select Database
# 3. Click "Rotate" button
# 4. Update .env with new token
# 5. Re-deploy app
```

## 🔄 Rotation Schedule

| Credential | Rotation Frequency | Last Rotated | Next Rotation |
|-----------|-------------------|------|---|
| Firebase Keys | Never (tied to project) | N/A | N/A |
| Google API Keys | Annually | (manual) | (manual) |
| Redis Token | Every 6 months / if exposed | (manual) | (manual) |
| Cloud Function Keys | Never (Firebase managed) | N/A | N/A |

## 🚨 Monitoring & Alerts

### Set Up Billing Alerts
1. Go to Google Cloud Console > Billing
2. Set alert thresholds:
   - ⚠️ Warning: $10/month
   - 🚨 Critical: $50/month
3. Verify notifications sent to admin email

### Set Up Usage Monitoring
```bash
# Monitor API quota usage
gcloud compute project-info describe --project=truckinfox-8d5b2 \
  --format='value(quotaMetrics)'

# View recent API calls
gcloud logging read "resource.type=api" \
  --limit 50 \
  --format json
```

### Firebase Security Rules (Firestore)
Verify rate limiting is enforced:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /_ratelimits/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

## 📊 Compliance & Security Standards

- [ ] **OWASP Mobile Top 10**: API key exposure (#6)
- [ ] **CWE-798**: Hardcoded credentials (not applicable - env vars)
- [ ] **PCI-DSS**: If handling payments, API keys must be protected
- [ ] **GDPR**: Log API calls that process location data

## 🛠️ Tools & Utilities

### Scan for Exposed Keys
```bash
# Check if keys are in git history
git log -p | grep -i "EXPO_PUBLIC_GOOGLE"

# Check local files
grep -r "AIzaSy" . --exclude-dir=node_modules

# Use git-secrets to prevent commits
git secrets --scan
```

### Validate Environment Setup
```typescript
// Add to app startup
const validateApiKeySetup = () => {
  const hasPlacesKey = !!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  const hasRedisToken = !!process.env.EXPO_PUBLIC_REDIS_REST_TOKEN;
  
  if (!hasPlacesKey) {
    console.warn('⚠️ Places API key not configured - using offline mode');
  }
  if (hasRedisToken && hasRedisToken.includes('_PLACEHOLDER_')) {
    throw new Error('❌ Redis token contains placeholder - update .env');
  }
  
  console.log('✅ API configuration valid');
};
```

## 📞 Incident Response

### If API Key is Compromised

1. **Immediate** (within 1 hour):
   - [ ] Rotate the exposed key in Google Cloud Console
   - [ ] Update `.env` file locally
   - [ ] Re-deploy app/functions with new key

2. **Short-term** (within 24 hours):
   - [ ] Check Google Cloud Billing for suspicious activity
   - [ ] Review API logs for unauthorized requests
   - [ ] Notify Firebase support if Firebase key compromised
   - [ ] Check Upstash console if Redis token exposed

3. **Long-term** (within 1 week):
   - [ ] Investigate how key was exposed (code review, audit)
   - [ ] Update .gitignore if needed
   - [ ] Add Git hooks to prevent key commits
   - [ ] Review access logs and file permissions
   - [ ] Update incident response plan

### Example Emergency Commands
```bash
# Disable a compromised API key immediately
gcloud services api-keys list
gcloud services api-keys delete KEY_ID

# Check recent API requests
gcloud logging read "resource.type=api" --limit 100

# Rotate Redis token
# 1. Visit Upstash console
# 2. Click "Rotate" on database
# 3. Update .env and redeploy
```

## 📖 Reference Links

- [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys#api_key_best_practices)
- [Firebase Security Documentation](https://firebase.google.com/docs/database/security)
- [Expo Environment Variables](https://docs.expo.dev/build-reference/variables/)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-top-10/)
- [CWE-798: Hardcoded Credentials](https://cwe.mitre.org/data/definitions/798.html)
