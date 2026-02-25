# Algolia Search Setup (Cargo Requests)

This guide configures the `cargo_requests` Algolia index used by app search.

## 1) Required Environment Variables

Add these to `.env` (already present in `.env.example`):

```env
EXPO_PUBLIC_ALGOLIA_APP_ID=your_algolia_app_id
EXPO_PUBLIC_ALGOLIA_SEARCH_KEY=your_algolia_search_key
EXPO_PUBLIC_ALGOLIA_CARGO_REQUESTS_INDEX=cargo_requests
```

- `EXPO_PUBLIC_ALGOLIA_SEARCH_KEY` should be **search-only** (never admin key).
- Restart Metro after env changes.

## 2) Required Index and Fields

Create index: `cargo_requests` (or your custom value from `EXPO_PUBLIC_ALGOLIA_CARGO_REQUESTS_INDEX`).

Each record must include:

- `objectID` (string): Firestore cargo request document ID
- `status` (string): must be `active` for searchable records in-app
- `title` (string)
- `cargo_type` (string)
- `from_address` (string)

Recommended optional fields:

- `to_address`
- `price`
- `price_type`
- `pickup_date`
- `created_at`

## 3) Search Behavior Used by App

The app search uses:

- `filters: "status:active"`
- `hitsPerPage: 20`
- `attributesToRetrieve: ["title", "cargo_type", "from_address"]`

Implementation references:

- `utils/search.ts` (`searchRequests`)
- `hooks/useCargoRequests.ts` (All tab + non-empty query)

## 4) Index Settings (Recommended)

In Algolia index settings for `cargo_requests`:

- **Searchable attributes**: `title`, `cargo_type`, `from_address`, `to_address`
- **Attributes for faceting**: `status`, `cargo_type`, `price_type`
- **Custom ranking** (optional): `desc(created_at)`

## 5) Sync Strategy

Choose one:

- **Firestore -> Cloud Function -> Algolia** (recommended)
- Batch sync script for initial backfill + periodic updates

Minimum requirement: records in Algolia stay consistent with Firestore for `status` and `objectID`.

## 6) Quick Verification

1. Ensure at least one active request is indexed with `status: "active"`.
2. Start app and search using a word from `title` or `from_address`.
3. Confirm results appear only from active requests.
4. Temporarily remove env vars and verify app fails gracefully (empty results + warning log).

## Troubleshooting

- Empty results with valid query: verify `status` is exactly `active` in Algolia record.
- Missing records: verify `objectID` matches Firestore document ID.
- No search at all: verify env vars and restart app/Metro.
