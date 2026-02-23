# API Keys Protection: Deployment & Setup Guide

## 🎯 Quick Start

For **development**: Your current setup is secure enough with offline fallback.

For **production**: Follow the migration path below to move API keys server-side.

---

## 📋 Pre-Deployment Checklist

### Environment Variables ✅
- [x] `.env` created with API keys
- [x] `.env` added to `.gitignore`
- [x] `.env.example` with placeholders committed
- [x] No API keys in source code
- [x] `EXPO_PUBLIC_` prefix used for client-side vars

### Google Cloud Console Setup
- [ ] Project: `truckinfox-8d5b2`
- [ ] **Places API** enabled
- [ ] **Maps API** enabled
- [ ] API key created and retrieve API key
- [ ] API key restricted to Places + Maps only
- [ ] Android application restrictions configured
- [ ] iOS application restrictions configured
- [ ] Billing alerts set at $10 and $50

### Firebase Setup
- [ ] Firebase project initialized
- [ ] Cloud Functions enabled
- [ ] Firestore security rules updated
- [ ] Authentication enabled

---

## 🔧 Setup Instructions

### Step 1: Get Your API Keys

#### Google Places API Key
```bash
# In Google Cloud Console:
# 1. Go to APIs & Services > Credentials
# 2. Create API key (if not exists)
# 3. Name: "TruckInFox - Places API"
# 4. Copy the key value
```

#### Firebase Credentials
```bash
# Already in your .env file:
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDfuPykZ5BkcSSswXCTYkpsERZjw0XdG5c
# (These are safe - public by design)
```

### Step 2: Update Local Environment

```bash
# If you don't have .env yet:
cp .env.example .env

# Edit .env and replace placeholders:
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy... # Insert your key

# Verify it's ignored:
git status
# Should NOT show .env in the output
```

### Step 3: Test Offline Mode

```bash
# Temporarily remove the key to test offline fallback:
# In your terminal:
unset EXPO_PUBLIC_GOOGLE_PLACES_API_KEY

# Or edit .env:
# EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=  (leave empty)

npm start

# Test the app:
# 1. Go to Create Request screen
# 2. Try searching for an address
# 3. Should show only Norwegian cities
# 4. Verify app doesn't crash
```

### Step 4: Verify API Key Restrictions (Google Cloud)

```bash
# 1. Google Cloud Console > APIs & Services > Credentials
# 2. Click on your API key
# 3. Under "API Restrictions":
#    ✅ Select "Restrict key"
#    ✅ Choose only "Places API"
# 4. Under "Application Restrictions":
#    ✅ Android app: Add your package ID and SHA-1 fingerprint
#    ✅ iOS app: Add your bundle ID and team ID
# 5. Save
```

**Get Your Fingerprints:**

For Android (SHA-1):
```bash
# From EAS:
eas credentials show --platform android
# Look for "SHA-1 Fingerprint"

# Or locally:
./gradlew signingReport
```

For iOS (Bundle ID + Team ID):
```bash
# Your bundle ID (in app.json or Xcode):
com.truckinfox

# Your Apple Team ID:
# Found in Apple Developer Account
```

---

## 🚀 Production Deployment (Phase 2)

### When to Migrate to Cloud Functions?
- ✅ After app is stable in production (1-3 months)
- ✅ When user base is growing and quota concerns arise
- ✅ When you want per-user rate limiting
- ✅ Before handling sensitive customer data

### Migration Steps: Client-Side → Server-Side

#### Step 1: Deploy Cloud Function
```bash
# Copy the example to real Cloud Function:
cp functions/src/placesProxyExample.ts functions/src/placesProxy.ts

# Edit functions/src/index.ts and add:
export { placesAutocomplete, placeDetails, healthCheck } from './placesProxy';

# Deploy:
firebase deploy --only functions
```

#### Step 2: Set Server-Side API Key
```bash
# Option A: Firebase CLI
firebase functions:config:set places.api_key="YOUR_KEY_HERE"

# Option B: Google Cloud Console
# 1. Go to Cloud Functions > placesAutocomplete
# 2. Click "Edit"
# 3. Under "Runtime settings"
# 4. Add environment variable: GOOGLE_PLACES_API_KEY
# 5. Set value and save

# Verify:
firebase functions:config:get
```

#### Step 3: Update Client Code
```typescript
// OLD (Exposed):
import { searchNorwegianPlaces } from './utils/googlePlaces';
const results = await searchNorwegianPlaces('Oslo');

// NEW (Secure):
import { useSecurePlacesProxy } from './hooks/useSecurePlacesProxy';
const { searchPlaces } = useSecurePlacesProxy();
const results = await searchPlaces('Oslo');
```

#### Step 4: Test Cloud Function
```bash
# Test with sample data:
yarn test:functions

# Or manually:
firebase functions:shell
> placesAutocomplete({input: 'Oslo'})
# Should return: { predictions: [...], status: 'OK' }
```

#### Step 5: Build & Deploy App
```bash
# Build new app version with updated code:
eas build --platform ios
eas build --platform android

# Submit to App Store/Play Store
eas submit
```

#### Step 6: Remove Exposed Key from Client
```bash
# Once all users have updated app:
# Edit .env and remove:
# EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=...

# Or blanks it:
# EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=

# Commit:
git commit -am "Remove client-side API key exposure"
git push
```

---

## 🔐 Security Best Practices by Environment

### Development
```
✅ Use .env file with actual keys
✅ Add .env to .gitignore
✅ Keep git history clean
❌ Don't commit .env
```

### Staging
```
✅ Use different API keys from production
✅ Cloud Function deployed but not fully used
✅ Test both online (Cloud Function) and offline modes
❌ Don't share API keys in PRs
```

### Production
```
✅ Cloud Function handles all API calls
✅ API key only in Cloud Function environment
✅ Client app has no exposed keys
✅ Rate limiting enforced
✅ All requests logged and monitored
```

---

## 🧪 Testing Checklist

### Before Release to Production
- [ ] Offline mode works (addresses show Norwegian cities only)
- [ ] Online mode works (if API key configured)
- [ ] No API key in JavaScript bundle:
  ```bash
  # For Android:
  unzip app-release.apk
  strings classes.dex | grep "AIzaSy"
  # Should return: (no results)
  
  # For iOS:
  strings app.ipa | grep "AIzaSy"
  # Should return: (no results)
  ```
- [ ] Home screen loads without errors
- [ ] Address search works offline
- [ ] Address search works online (if key available)
- [ ] Error messages are user-friendly

### Performance Testing
```bash
# Monitor API latency:
npm run test:performance

# Expected latencies:
# - Offline mode: <50ms (local cities database)
# - Online mode: 200-500ms (Google API call)
```

---

## 🚨 Emergency: If Key is Exposed

### Immediate Actions (Within 1 Hour)

1. **Disable the key**:
   ```bash
   # In Google Cloud Console > APIs & Services > Credentials
   # Right-click key > Delete
   ```

2. **Generate new key**:
   ```bash
   # Create new API key
   # Apply same restrictions as before
   ```

3. **Update environment**:
   ```bash
   # For Cloud Functions:
   firebase functions:config:set places.api_key="NEW_KEY"
   firebase deploy --only functions
   
   # For .env (development):
   # Edit .env and update EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
   ```

4. **Monitor for abuse**:
   ```bash
   # Check Google Cloud Billing
   # Look for unusual API usage
   # Check logs for suspicious requests
   ```

5. **Communicate**:
   - [ ] Inform team of incident
   - [ ] Update deployment documentation
   - [ ] Plan for code audit

### Medium-term Actions (Within 24 Hours)
- [ ] Review git history for exposed key
- [ ] Check API usage logs for unauthorized requests
- [ ] Calculate potential damage (costs, data accessed)
- [ ] Update security policies
- [ ] Add monitoring/alerts

### Long-term Actions (Within 1 Week)
- [ ] Implement automated key rotation
- [ ] Add git hooks to prevent key commits
- [ ] Conduct security audit
- [ ] Update team training on key management
- [ ] Review incident response plan

---

## 📊 Monitoring & Maintenance

### Weekly Tasks
- [ ] Check Google Cloud Billing for anomalies
- [ ] Review API usage trends
- [ ] Verify Cloud Function health checks passing

### Monthly Tasks
- [ ] Review access logs in Cloud Logging
- [ ] Verify rate limiting is working
- [ ] Check for security updates
- [ ] Update documentation

### Quarterly Tasks
- [ ] Review and rotate API keys
- [ ] Audit all environments for exposed keys
- [ ] Security training for team
- [ ] Update incident response plan

### Key Rotation Schedule
```
Firebase Keys:      Never (tied to project)
Google API Keys:    Annually (March)
Redis Credentials:  Every 6 months (March & September)
Cloud Function:     Managed by Firebase (auto)
```

---

## 🎓 Resources & References

### Official Documentation
- [Google Cloud API Keys Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Expo Environment Variables](https://docs.expo.dev/build-reference/variables/)
- [React Native Security](https://reactnative.dev/docs/security)

### Security Standards
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [PCI DSS 3.4: Render PAN Unreadable](https://www.pcisecuritystandards.org/)

### Tools
- [git-secrets](https://github.com/awslabs/git-secrets) - Prevent credential commits
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - Scan for exposed secrets
- [Snyk](https://snyk.io/) - Vulnerability scanning

---

## ✅ Deployment Sign-off

Once you've completed all steps above, check these boxes:

**Development Setup:**
- [ ] .env file created and secured
- [ ] API keys added to .env (not in code)
- [ ] .gitignore protects .env
- [ ] Offline mode tested
- [ ] Online mode tested

**Google Cloud Setup:**
- [ ] API key created and restricted
- [ ] Android restrictions configured
- [ ] iOS restrictions configured
- [ ] Billing alerts set

**Security Hardening:**
- [ ] No API keys in git history
- [ ] No API keys will be in app bundle
- [ ] Rate limiting configured
- [ ] Error handling in place
- [ ] Monitoring set up

**Documentation:**
- [ ] Team trained on key management
- [ ] Emergency procedures reviewed
- [ ] Rotation schedule documented
- [ ] This checklist checked off

---

**Questions?** See `GOOGLE_PLACES_API_SECURITY.md` for detailed technical guide.
