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
