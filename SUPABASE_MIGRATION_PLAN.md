# Supabase migration plan for TruckinFox

This plan is based on the current mobile code and existing schema in `supabase/schema.sql`.

## 1) What is currently used in Firebase

From the app code, the main collections are:

- `users`
- `cargo_requests`
- `bids`
- `orders`
- `messages`
- `typing_indicators`
- `notifications`
- `reviews`
- `payments`
- `escrow_payments`
- `user_favorites`
- `deliveries`
- `chats`

This aligns with the existing Supabase schema.

## 2) Current mapping to Supabase

- `users` -> `profiles` (+ compatibility view `users`)
- `cargo_requests` -> `cargo_requests`
- `bids` -> `bids`
- `orders` -> `orders`
- `messages` -> `messages`
- `typing_indicators` -> `typing_indicators`
- `notifications` -> `notifications`
- `reviews` -> `reviews`
- `payments` -> `payments`
- `escrow_payments` -> `escrow_payments`
- `user_favorites` -> `user_favorites`
- `deliveries` -> `deliveries`
- `chats` -> `chats`

## 3) Why this schema is Node.js-friendly

The schema is already prepared for future Node.js backend usage:

- UUID primary and foreign keys everywhere
- `TIMESTAMPTZ` for all time-sensitive domain entities
- strict FK constraints for referential integrity
- `snake_case` naming (clean mapping for Sequelize/TypeORM/Prisma)
- JSONB fields where extensibility is needed (`metadata`, `data`, `route`)
- RLS policies for client access and `service_role` path for backend jobs

## 4) Self-host Supabase with Docker (no cloud costs)

### Local/staging via Supabase CLI

1. Install Supabase CLI
2. From project root run:

```bash
supabase start
```

This starts local Docker services (`db`, `auth`, `rest`, `realtime`, `storage`, `studio`).

3. Apply schema:

```bash
supabase db reset
```

### Production on your own server

Recommended approach:

1. Use a Linux VM with Docker + Docker Compose
2. Deploy official Supabase self-host stack
3. Apply this project schema (`supabase/schema.sql`) to the Postgres instance
4. Put API behind reverse proxy (Nginx/Caddy) with TLS
5. Store keys in server environment (never in mobile bundle except `anon` key)

## 5) Current status

Firebase dependency and `lib/firebase.ts` were removed from the project.
The codebase still contains legacy imports that should be migrated module-by-module to Supabase queries.

Completed in this phase:

- `contexts/AuthContext.tsx` migrated to `supabase.auth`
- `app/(auth)/forgot-password.tsx` migrated to Supabase password reset flow
- `app/(tabs)/orders.tsx` migrated to Supabase orders query
- `app/(tabs)/messages.tsx` migrated to Supabase messages/users/requests queries
- `app/chat/[requestId]/[userId].tsx` migrated to Supabase messages + typing Realtime
- `app/order-status/[orderId].tsx` migrated to Supabase order + escrow Realtime
- `app/(tabs)/create.tsx` migrated to Supabase create flow + storage uploads
- `app/edit-request/[id].tsx` migrated to Supabase edit flow + storage uploads
- `app/request-details/[id].tsx` migrated to Supabase request details data fetching
- `components/AvatarUpload.tsx` migrated to Supabase storage/profile updates
- `utils/requestValidation.ts` migrated to Supabase data validation queries
- `utils/chatManagement.ts` migrated to Supabase chat lifecycle operations
- `hooks/useCargoRequests.ts` migrated to Supabase pagination and filters
- `hooks/useFavorites.ts` migrated to Supabase favorites table
- `hooks/useCities.ts` migrated to Supabase-backed city list
- `utils/deliveryProof.ts` migrated to Supabase storage/order updates/function invoke
- `utils/escrowManagement.ts` migrated to Supabase escrow utilities
- `hooks/usePaymentHistory.ts` migrated to Supabase payments pagination
- `hooks/useFirestoreCollection.ts` replaced with Supabase query + Realtime hook
- `hooks/useFirestoreDocument.ts` replaced with Supabase row + Realtime hook
- `utils/notifications.ts` migrated to Supabase notifications + Realtime
- `hooks/useSecurePlacesProxy.ts` migrated to Supabase Edge Functions proxy
- `utils/rateLimitClient.ts` migrated to Supabase Edge Functions caller
- `utils/fcm.ts` migrated to Supabase profile push token persistence
- `utils/geoSearch.ts` migrated to Supabase location queries
- `utils/orderCleanup.ts` migrated to Supabase order cleanup queries
- `utils/idempotency.ts` migrated to Supabase idempotency checks
- `utils/batchFetch.ts` migrated to Supabase batch fetch queries
- `lib/firestore-helpers.ts` migrated to Supabase helper APIs
- `utils/search.ts` migrated to Supabase search queries
- `lib/safeFirestoreOps.ts` migrated to Supabase safe operation wrappers
- `lib/offlineSync.ts` migrated to Supabase offline queue sync
- `utils/analytics.ts`, `lib/analytics.ts`, `utils/performance.ts` migrated off Firebase runtime SDK usage
- Jest setup/tests migrated off Firebase mocks (`jest.setup.js`, `__tests__/utils/analytics.test.ts`)

Firebase import sweep is now clean for workspace source files (`ts/tsx/js/jsx`): no Firebase imports remain.

## 6) Progressive migration strategy from legacy Firebase code

1. Replace legacy imports in `contexts/AuthContext.tsx` with Supabase Auth
2. Migrate Firestore hooks (`useFirestoreCollection`, `useFirestoreDocument`) to Supabase queries + Realtime
3. Migrate chat/tracking writes to Supabase tables (`messages`, `tracking`, `typing_indicators`)
4. Migrate storage uploads to Supabase Storage buckets
5. Remove legacy helpers (`safeFirestoreOps`, `offlineSync`, Firestore utils) after module parity

## 7) Suggested adapter boundary for app code

Introduce one small abstraction layer:

- `lib/data/usersRepo.ts`
- `lib/data/cargoRepo.ts`
- `lib/data/chatRepo.ts`
- `lib/data/ordersRepo.ts`

Then keep only one backend implementation:

- `supabase` implementation

## 8) Realtime for core TruckinFox scenarios

Use Supabase Realtime subscriptions for:

- `messages` (chat updates)
- `tracking` (truck location updates)
- `notifications` (in-app badges)
- `typing_indicators` (typing status)

Your schema already enables publication for these tables.

## 9) Security, Indexing, Triggers & Activity Log

Migration `20260227170000_rls_indexes_triggers_activity_log_backup.sql` adds all items below.

### 9.1 Admin RLS policies (trucks · chats · messages)

The schema uses a lightweight `is_admin BOOLEAN` column on `profiles` (default `FALSE`).
Only a `service_role` backend job can set it to `TRUE`, so regular users cannot elevate
their own permissions.

The helper function `public.is_admin()` (SECURITY DEFINER) checks the flag:

```sql
-- Grant admin rights to a user (run with service_role key only)
UPDATE public.profiles SET is_admin = TRUE WHERE id = '<admin-user-uuid>';
```

RLS policy pattern (same for chats / messages):

```sql
-- Owner-only visibility (already in base schema):
CREATE POLICY "Carriers can view their trucks"
  ON public.trucks FOR SELECT
  USING (auth.uid() = carrier_id);

-- Administrator full access:
CREATE POLICY "Admins have full access to trucks"
  ON public.trucks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

> **Security note:** `public.is_admin()` runs as SECURITY DEFINER, so the
> `profiles` lookup always executes as the function owner (`postgres`).
> This prevents a crafted RLS bypass via the calling user's own row context.

### 9.2 Indexing strategy

| Column(s) | Tables | Reason |
|-----------|--------|--------|
| `created_at DESC` | `trucks`, `chats`, `messages`, `activity_log` | Pagination / newest-first lists |
| `carrier_id, created_at DESC` | `trucks` | Carrier fleet list, paginated |
| `user_a_id / user_b_id, created_at DESC` | `chats` | Per-user chat list, newest first |
| `chat_id, created_at DESC` | `messages` | "Load earlier messages" cursor |
| `country_code, created_at DESC` | `profiles` | Admin reports per region |
| `is_admin` (partial, WHERE TRUE) | `profiles` | Fast admin lookup in RLS |
| `entity_type, entity_id` | `activity_log` | Look up all events for one entity |

All indexes use `IF NOT EXISTS` and are added idempotently in the migration.

### 9.3 Storage media cleanup triggers

When a row is **hard-deleted** (not soft-deleted), associated Storage objects are
automatically removed via SECURITY DEFINER triggers:

| Table | Bucket | Path pattern deleted |
|-------|--------|----------------------|
| `trucks` | `trucks` | `{carrier_id}/{truck_id}/%` |
| `messages` | `chat` | `{chat_id}/{message_id}/%` (only when `media_url IS NOT NULL`) |

```sql
-- Example: deleting a truck also removes its images from Storage
DELETE FROM public.trucks WHERE id = '<truck-uuid>';
-- → triggers delete_truck_storage_media()
-- → DELETE FROM storage.objects WHERE bucket_id = 'trucks'
--     AND name LIKE '<carrier_id>/<truck_id>/%'
```

> **GDPR note:** These triggers implement the *right to erasure* (Art. 17 GDPR)
> at the database level, ensuring no orphaned media files remain after a deletion.

### 9.4 activity_log table + log_activity() function

`activity_log` records high-level **application events** (distinct from `audit_log`
which records security mutations with before/after data snapshots).

| Column | Purpose |
|--------|---------|
| `user_id` | Actor (SET NULL on profile deletion = GDPR anonymisation) |
| `action` | Dot-separated event name, e.g. `truck.created`, `order.status_changed` |
| `entity_type` | Target table name, e.g. `trucks`, `orders` |
| `entity_id` | Primary key of the affected row |
| `metadata` | Arbitrary JSON payload (no sensitive PII) |

Usage example (from an Edge Function or backend service):

```sql
SELECT public.log_activity(
  auth.uid(),                                        -- actor
  'truck.created',                                   -- event
  'trucks',                                          -- entity table
  '550e8400-e29b-41d4-a716-446655440000'::uuid,      -- entity id
  '{"plate_number": "AB12345", "country": "NO"}'::jsonb
);
```

> **Access control:** `activity_log` has **no** permissive SELECT/INSERT policy
> for `authenticated` or `anon` roles. Only `service_role` (backend jobs, Edge
> Functions) can write or read records. This mirrors the `audit_log` approach.

### 9.5 Storage bucket policy recommendations

All private buckets (`chat`, `avatars`) follow the **owner-or-admin** pattern:

```sql
-- Regular user: can only access objects inside their own folder
CREATE POLICY "Owner reads own files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Administrator: unrestricted access (moderation / GDPR)
CREATE POLICY "Admins have full access to avatars bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());
```

Additional recommendations:
- Keep all non-public media buckets (`chat`, `avatars`) with `public = false`.
- Use **signed URLs** (`storage.createSignedUrl`) with a short TTL (e.g. 5–15 minutes)
  instead of public object URLs for sensitive files.
- Set `file_size_limit` and `allowed_mime_types` on every bucket to prevent abuse.
- Rotate `service_role` key regularly; never expose it in the mobile bundle.

## 10) Backup strategy (schema + storage)

### 10.1 Database (schema + data)

**Supabase Cloud** — Point-in-time recovery (PITR) is available on Pro and above plans.
Enable it in the Supabase Dashboard → Settings → Database → PITR.

**Self-hosted** — Schedule daily logical backups with `pg_dump`:

```bash
#!/bin/bash
# /etc/cron.daily/truckinfox-backup
set -euo pipefail

DB_URL="postgresql://postgres:<password>@localhost:5432/postgres"
BACKUP_DIR="/var/backups/truckinfox/db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Full schema + data dump (plain SQL, gzip-compressed)
pg_dump "$DB_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/truckinfox_${DATE}.dump"

# Keep only the last 30 daily backups
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
```

Restore:

```bash
pg_restore \
  --dbname="$DB_URL" \
  --no-owner \
  --no-acl \
  --clean \
  "$BACKUP_DIR/truckinfox_20260227_020000.dump"
```

### 10.2 Storage files

Back up `storage.objects` metadata (database) together with the actual file blobs.

**Supabase Cloud** — Storage is backed up as part of the project backup; also use
`supabase db dump` for the metadata table.

**Self-hosted / S3-compatible backend:**

```bash
#!/bin/bash
# Sync all Storage buckets to a secondary S3 bucket
BUCKETS=(avatars trucks cargo chat)
for bucket in "${BUCKETS[@]}"; do
  aws s3 sync \
    "s3://truckinfox-primary/${bucket}/" \
    "s3://truckinfox-backup/${bucket}/" \
    --delete \
    --storage-class STANDARD_IA
done
```

### 10.3 Retention & compliance (GDPR)

| Category | Retention | Deletion method |
|----------|-----------|-----------------|
| User profiles | Until account deletion + 30-day grace | `DELETE FROM profiles` → CASCADE |
| Messages | 2 years from `created_at` | Scheduled `DELETE` job |
| `audit_log` | 5 years (legal requirement) | Scheduled `DELETE` job (service_role) |
| `activity_log` | 2 years | Scheduled `DELETE` job (service_role) |
| Storage files | Deleted with row (trigger) | `delete_truck/message_storage_media()` |
| Database backups | 90 days of daily backups | Cron job prunes old `.dump` files |

### 10.4 Scaling considerations

- **Partitioning:** When `activity_log` or `messages` exceed ~50 M rows, apply
  range partitioning by `created_at` (monthly partitions) to keep vacuum and
  index maintenance manageable.
- **Read replicas:** Supabase Pro supports read replicas; route heavy analytics
  queries (admin reports, backup exports) to the replica.
- **Connection pooling:** Use PgBouncer (included in Supabase) in transaction mode
  for mobile clients; use session mode only for backend jobs that use advisory locks.
