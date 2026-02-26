# Firebase Error Monitoring Checklist (No Sentry)

This checklist keeps error monitoring fully on Firebase services.

## 1) Runtime Error Logging in App

- [ ] Keep `ErrorBoundary` enabled and reporting app errors via Firebase analytics event (`app_error`).
- [ ] Keep error messages sanitized (no tokens, API keys, personal data).
- [ ] Verify development errors still appear in local console for debugging.

## 2) Firebase Analytics Visibility

- [ ] Open Firebase Console → Analytics → Events.
- [ ] Confirm `app_error` event appears after a forced test error.
- [ ] Add event parameter filters for `source`, `has_stack`, and `message`.

### Quick dashboard setup for `app_error`

- [ ] Go to Analytics → Events → `app_error` → mark as conversion (optional for alert-style tracking).
- [ ] In Reports, create a detail report with breakdown by parameter `source`.
- [ ] Add a filter: `has_stack = 1` to prioritize actionable crashes first.
- [ ] Add a second view grouped by `message` to find repeated failures.
- [ ] Compare last 7 days vs previous period to catch regressions after releases.
- [ ] Save an Exploration with dimensions: `Event name`, `source`, `message`; metric: `Event count`.

## 3) Optional Alerting via Cloud Functions

- [ ] If needed, create a scheduled Cloud Function that queries high `app_error` frequency and sends alert (Slack/email).
- [ ] Add threshold per environment (e.g. production only).

## 4) Release Verification (Before Production)

- [ ] Run `npm run type-check`.
- [ ] Run `npm test -- --watchAll=false`.
- [ ] Validate Firebase config values are correct in `.env`/EAS.
- [ ] Verify Firestore rules deployment: `firebase deploy --only firestore:rules`.

## 5) Incident Triage Workflow

- [ ] Triage by `source` first (screen/component name).
- [ ] Group recurring errors by message pattern.
- [ ] Create a fix issue with reproduction steps and affected app flow.
- [ ] After release, confirm `app_error` trend decreases.

## Notes

- This project intentionally does not use Sentry.
- Primary telemetry path for runtime app errors is Firebase Analytics.
