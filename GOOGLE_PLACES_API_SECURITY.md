# Google Places API Security Guide

## Overview

This document outlines best practices for protecting Google Places API keys in the TruckInFox mobile application. Since this is a React Native/Expo application, special care must be taken to prevent API key exposure in client-side code.

## Security Architecture

### Current Implementation

- **Offline Fallback**: Norwegian cities database for when API is unavailable or key missing
- **Environment Variables**: Key stored in `.env` with `EXPO_PUBLIC_` prefix (required for Expo)
- **Graceful Degradation**: App works offline with reduced functionality

### Recommended Security Approach: Backend Proxy (Production)

For production deployments, use a **backend proxy** instead of exposing the API key directly in the client:

```typescript
// Client-side (safe - no credentials)
const response = await fetch('https://api.myapp.com/places/autocomplete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: searchQuery }),
});

// Server-side (Firebase Cloud Function - protected)
export const placesAutocomplete = functions.https.onCall(async (data, context) => {
  // Verify user authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY; // Private server variable

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
      `input=${encodeURIComponent(data.input)}&` +
      `components=country:no&` +
      `key=${googleApiKey}`
  );

  return response.json();
});
```

## Implementation Strategy

### Phase 1: Development (Current)

✅ Use environment variables with offline fallback

- API key in `.env` file
- Never committed to git (`.env` in `.gitignore`)
- Offline access to Norwegian cities works without key
- Suitable for local testing

### Phase 2: Production (Recommended)

- Move API calls to **Firebase Cloud Functions**
- Cloud Function stores API key via environment variables
- Client calls Cloud Function instead of Google API directly
- Enables per-user rate limiting and quota management
- Can add authentication checks before allowing access

## Environment Variable Setup

### .env File Example

```dotenv
# Google Places API Configuration
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...YOUR_KEY_HERE
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...YOUR_KEY_HERE

# These keys are exposed in the app bundle (development only)
# For production, move to Cloud Functions environment variables
GOOGLE_PLACES_API_KEY_PRIVATE=AIzaSy...YOUR_KEY_HERE  # Not used currently
```

### Securing API Keys in GCP

1. **Enable Cloud Functions API** in GCP Console
2. **Set Environment Variables** in Firebase Cloud Function settings:
   ```bash
   gcloud functions deploy placesAutocomplete \
     --set-env-vars GOOGLE_PLACES_API_KEY="your_key_here"
   ```
3. **Restrict API Key** in GCP Console:
   - Go to APIs & Services > Credentials
   - Edit the API key
   - Set **API restrictions** to only "Places API"
   - Set **Application restrictions** to your app's package name/bundle ID

## API Key Restrictions (Current Setup)

To minimize exposure in development:

### Google Cloud Console Steps:

1. Navigate to APIs & Services > Credentials
2. Find your API key
3. Click to edit
4. **API Restrictions**:
   - ✅ Places API
   - ✅ Maps Static API
   - ❌ All other APIs
5. **Application Restrictions**:
   - Select "Android app" and add your app package name
   - Select "iOS app" and add your app bundle ID
6. **HTTP Referrer Restrictions**:
   - Can't be used for Expo apps (they use multiple referrers)
   - Skip this for development

## Rate Limiting & Quota Management

### Google Cloud Console

- Set **quota limits** per API to prevent accidental overage
- Example: 1000 requests/day for Places API
- Enable **billing alerts** at $50, $100, $500

### Application-Level Rate Limiting

Implement throttling in the client:

```typescript
// utils/rateLimiter.ts
const lastRequestTime: { [key: string]: number } = {};
const MIN_REQUEST_INTERVAL_MS = 300; // Minimum 300ms between requests

export const throttledPlacesSearch = (key: string) => {
  const now = Date.now();
  const lastTime = lastRequestTime[key] || 0;

  if (now - lastTime < MIN_REQUEST_INTERVAL_MS) {
    return null; // Skip request
  }

  lastRequestTime[key] = now;
  return true; // Allow request
};
```

## Handling Missing API Keys

### Graceful Degradation

The app currently implements offline fallback:

```typescript
// If API key missing or API fails:
// 1. Show cached Norwegian cities
// 2. Allow manual address entry
// 3. Store user's frequently searched locations
// 4. Warn user: "Offline mode - Limited to Norwegian cities"
```

## Secrets Management for CI/CD

### GitHub Actions Secrets (if deployed)

1. Go to Repo Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Add `GOOGLE_PLACES_API_KEY` (development only - not recommended)
4. Reference in workflow: `secrets.GOOGLE_PLACES_API_KEY`

**Better approach**: Use Firebase CLI with service account:

```bash
firebase functions:config:set places.api_key="$GOOGLE_PLACES_API_KEY"
```

## Monitoring & Logging

### What to Log

```typescript
// ✅ Safe to log
console.log('Places API: 5 results returned');
console.log('Places API: Request took 234ms');

// ❌ Never log
console.error(`Places API error: Key rejected`); // Implies key exists
console.log(`API response: ${JSON.stringify(response)}`); // May contain coordinates
```

### Production Monitoring

- Use Firebase Performance Monitoring to track API latency
- Set up Cloud Logging alerts for API errors
- Monitor quotas via GCP Console > Billing

## Testing & QA

### Removing Client-Side Exposure

Before production deployment:

1. **Remove environment variable** from `.env`:

   ```bash
   # Remove this line before deploying to production
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=...
   ```

2. **Test offline mode**:

   ```bash
   # Temporarily unset the key
   unset EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
   npm start
   ```

3. **Verify fallback works**: App should show Norwegian cities only

## Checklist for Production Deployment

- [ ] API key moved to **Firebase Cloud Function** environment variables
- [ ] Client app uses **Cloud Function** for place searches (no direct API calls)
- [ ] API key **not in source code** or `.env` file
- [ ] `.env` file is in `.gitignore` (already configured)
- [ ] API key has **API restrictions** (Places API only)
- [ ] API key has **app restrictions** (Android/iOS package IDs)
- [ ] Cloud Function has **authentication checks**
- [ ] Rate limiting implemented (min 300ms between requests)
- [ ] Billing alerts configured
- [ ] Error handling gracefully falls back to offline mode
- [ ] Monitoring/logging configured in Cloud Logging
- [ ] No API key in CloudFlare/CDN logs
- [ ] No API key in error tracking (Sentry/Firebase Crashlytics)

## Migration Path: API Key Exposure → Proxy

### Step 1: Create Cloud Function

```bash
firebase functions:new placesAutocomplete --typescript
```

### Step 2: Implement Proxy Logic

See `functions/src/placesProxyExample.ts` (sample implementation)

### Step 3: Update Client Code

```typescript
// OLD (Exposed)
const response = await fetch(
  `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${GOOGLE_PLACES_API_KEY}`
);

// NEW (Proxied)
const response = await fetch('https://api.myapp.com/places/autocomplete', {
  method: 'POST',
  body: JSON.stringify({ input }),
});
```

### Step 4: Remove Exposed Key

- Delete `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` from `.env`
- Verify app still works in offline mode
- Deploy to production

## Support & Resources

- [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys#api_key_best_practices)
- [Firebase Cloud Functions Security](https://firebase.google.com/docs/functions/tips)
- [Expo Environment Variables](https://docs.expo.dev/build-reference/variables/)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-top-10/)
