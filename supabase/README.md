# TruckInfoX — Supabase Schema Guide

Цей документ описує схему бази даних Supabase (PostgreSQL), надає рекомендації з реальних підключень та інтеграції з Node.js ORM.

## Таблиці та зв'язки

```
auth.users (Supabase built-in)
  │
  └─── profiles (1:1)
        │
        ├─── trucks (1:N) ──── tracking (1:N)
        │
        ├─── cargo_requests (1:N) ──── bids (1:N)
        │                    │
        │                    └─── orders (1:1 or 1:N)
        │                             ├─── payments (1:N)
        │                             ├─── escrow_payments (1:N)
        │                             └─── deliveries (1:1)
        │
        ├─── reviews (as reviewer/reviewed)
        ├─── user_favorites (N:M з cargo_requests)
        ├─── notifications (1:N)
        └─── chats (N:M через user_a_id / user_b_id) ──── messages (1:N)
```

### profiles
Розширює стандартну таблицю `auth.users`. Зберігає публічний профіль: ім'я, тип акаунту (`customer` / `carrier`), регіон (`country_code`, `language`), рейтинг.

### trucks
Вантажівки перевізника. Поля: `plate_number`, `model`, `capacity_kg`, `volume_m3`, `truck_type`, `status`. Прив'язані до `profiles` через `carrier_id`.

### cargo_requests
Запити на перевезення вантажу від замовників. Містять маршрут (адреси + координати), вагу, тип вантажу, ціну, статус (`open` → `in_transit` → `delivered`). Повнотекстовий пошук через `search_tokens` (GIN-індекс).

### bids
Ставки перевізників на запити. Унікальна пара `(request_id, carrier_id)`. Після прийняття — `cargo_requests.accepted_bid_id` вказує на цю ставку.

### tracking
GPS-позиції вантажівок (широта, довгота, швидкість, напрямок). Прив'язані до `trucks` та опціонально до активного `cargo_requests`. Рекомендовано підписуватися на INSERT через Supabase Realtime.

### chats
Чат-сесія між двома користувачами (`user_a_id`, `user_b_id`) у контексті замовлення (`request_id`). Зберігає кількість непрочитаних та останнє повідомлення для швидкого відображення у списку чатів.

### messages
Окремі повідомлення з підтримкою тексту та медіа-вкладень (шлях у Supabase Storage). Статус доставки/читання через `delivered_at` / `read_at`.

### orders
Замовлення між `customer` і `carrier` після прийняття ставки. Містить платіжні поля `total_amount`, `platform_fee`, `carrier_amount`, а також `status` і `payment_status`.

### payments
Історія платежів для екранів фінансів (`pending/completed/failed/refunded`) з підтримкою сортування за `created_at`.

### escrow_payments
Escrow-життєвий цикл для Vipps/іншого провайдера з `idempotency_key`, `provider_order_id`, `payment_url` і статусами (`initiated`, `paid`, `released`, ...).

---

## Vipps Edge Function deploy (vipps-payment)

For å unngå `HTTP 404 Requested function was not found` fra mobilappen må Edge Function `vipps-payment` være deployet i Supabase-prosjektet.

Function source:

- `supabase/functions/vipps-payment/index.ts`

### 1) Logg inn og link prosjekt

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

### 2) Sett secrets for funksjonen

Mock mode er aktiv som standard i funksjonen (`VIPPS_MOCK_MODE=true`) og er nyttig i dev.

```bash
supabase secrets set VIPPS_MOCK_MODE=true
```

For ekte Vipps i prod:

```bash
supabase secrets set VIPPS_MOCK_MODE=false
supabase secrets set VIPPS_CLIENT_ID=<...>
supabase secrets set VIPPS_CLIENT_SECRET=<...>
supabase secrets set VIPPS_SUBSCRIPTION_KEY=<...>
supabase secrets set VIPPS_MERCHANT_SERIAL_NUMBER=<...>
supabase secrets set VIPPS_SYSTEM_NAME=truckinfox
supabase secrets set VIPPS_SYSTEM_VERSION=1.0.0
supabase secrets set VIPPS_PLUGIN_NAME=truckinfox-mobile
supabase secrets set VIPPS_PLUGIN_VERSION=1.0.0
```

### 3) Deploy funksjonen

```bash
supabase functions deploy vipps-payment
```

### 4) Verifiser at funksjonen finnes

```bash
supabase functions list
```

Du skal se `vipps-payment` i listen.

### 5) App-konfig (valgfritt)

Mobilappen bruker som default funksjonsnavn `vipps-payment`. Hvis dere bruker annet navn, sett:

```env
EXPO_PUBLIC_VIPPS_FUNCTION_NAME=vipps-payment
```

### 6) Lokal test via CLI (hurtigsjekk)

```bash
supabase functions serve vipps-payment --env-file .env
```

Eksempel request (mock):

```bash
curl -i http://127.0.0.1:54321/functions/v1/vipps-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_OR_SERVICE_ROLE_JWT>" \
  -H "Idempotency-Key: local-test-1" \
  -d '{
    "escrow_payment_id":"00000000-0000-0000-0000-000000000001",
    "order_id":"00000000-0000-0000-0000-000000000002",
    "amount":1100,
    "customer_phone":"+4799999999",
    "description":"Payment - Test"
  }'
```

Forventet i mock mode: HTTP 200 med `vipps_url` / `payment_url`.

### notifications
Користувацькі нотифікації (`new_bid`, `bid_accepted`, `payment_success`, `order_status_change`) з `read/read_at` і додатковим `data JSONB`.

### user_favorites
Зв'язка користувач ↔ запит на вантаж для фаворитів. Унікальність `(user_id, request_id)`.

### reviews
Відгуки між користувачами (1–5), прив'язка до `order_id`, `reviewer_id`, `reviewed_id`.

### deliveries
Актуальна позиція доставки на рівні замовлення (`deliveries/{order_id}` концептуально), включно з `route` (JSONB).

### typing_indicators
Індикатори набору в чаті для пари `(request_id, user_id)`.

---

## Supabase Storage — структура бакетів

| Бакет | Шлях об'єкта | Призначення |
|---|---|---|
| `trucks` | `trucks/{truck_id}/{filename}` | Фото вантажівок |
| `cargo` | `cargo/{request_id}/{filename}` | Фото вантажу |
| `chat` | `chat/{chat_id}/{message_id}/{filename}` | Медіа у повідомленнях |
| `avatars` | `avatars/{user_id}/{filename}` | Аватари користувачів |

### Корисні SQL snippets

- `snippets/explain_analyze_key_queries.sql` — базові `EXPLAIN ANALYZE` перевірки для гарячих запитів.
- `snippets/partitioning_tracking_messages_monthly.sql` — покроковий план місячного partitioning для великих таблиць.
- `snippets/storage_zero_byte_audit_cleanup.sql` — аудит і cleanup 0-byte файлів у `storage.objects` з безпечним preview перед delete.

### Storage 0-byte audit helpers (migration)

Після застосування migration `20260301102000_add_storage_zero_byte_audit_helpers.sql` доступні helper-и:

- `public.storage_zero_byte_objects_v` — view з 0-byte об'єктами у бакетах `cargo/avatars/chat/trucks`.
- `public.storage_zero_byte_summary()` — швидка агрегована статистика по бакетах.
- `public.storage_zero_byte_request_image_refs()` — посилання у `cargo_requests.images`, що вказують на 0-byte `cargo` об'єкти.

Приклади:

```sql
select * from public.storage_zero_byte_summary();
select * from public.storage_zero_byte_objects_v order by created_at desc limit 100;
select * from public.storage_zero_byte_request_image_refs() limit 100;
```

### Daily snapshot audit (scheduler-ready)

Після migration `20260301104500_add_storage_zero_byte_daily_audit.sql` з'являються:

- `public.storage_zero_byte_audit_runs` — таблиця історії snapshot-ів.
- `public.capture_storage_zero_byte_snapshot(_notes text)` — функція для запису snapshot.
- `public.storage_zero_byte_audit_latest_v` — останній snapshot.

Приклади ручного запуску:

```sql
select public.capture_storage_zero_byte_snapshot('manual run from SQL editor');
select * from public.storage_zero_byte_audit_latest_v;
select run_at, total_zero_byte_count from public.storage_zero_byte_audit_runs order by run_at desc limit 30;
```

Retention (щоб таблиця snapshot-ів не розросталась):

```sql
select public.prune_storage_zero_byte_audit_runs(); -- default 180 days
select public.prune_storage_zero_byte_audit_runs(365); -- custom window
```

Health-check (контроль, що scheduler працює):

```sql
select * from public.storage_zero_byte_audit_health_v;
```

Ключові поля:

- `last_snapshot_at` — час останнього snapshot.
- `hours_since_last_snapshot` — скільки годин минуло.
- `is_stale` — `true`, якщо останній snapshot старіший за 30 годин.

Опційно (якщо увімкнено `pg_cron`) можна планувати щоденний запуск:

```sql
select cron.schedule(
  'storage-zero-byte-daily',
  '15 3 * * *',
  $$select public.capture_storage_zero_byte_snapshot('pg_cron daily 03:15 UTC');$$
);

select cron.schedule(
  'storage-zero-byte-retention-weekly',
  '30 3 * * 0',
  $$select public.prune_storage_zero_byte_audit_runs(180);$$
);
```

---

## Рекомендації для Realtime та Node.js Backend

### Supabase Realtime (клієнт / мобільний застосунок)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Підписка на нові повідомлення у конкретному чаті
const chatChannel = supabase
  .channel(`chat:${chatId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
    (payload) => console.log('Нове повідомлення:', payload.new)
  )
  .subscribe();

// Підписка на GPS-позиції вантажівки
const trackingChannel = supabase
  .channel(`tracking:${truckId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'tracking', filter: `truck_id=eq.${truckId}` },
    (payload) => console.log('Нова позиція:', payload.new)
  )
  .subscribe();

// Відписка при виході з екрану
chatChannel.unsubscribe();
trackingChannel.unsubscribe();
```

### Node.js з Supabase (service_role — обхід RLS)

```typescript
import { createClient } from '@supabase/supabase-js';

// Використовуйте service_role ЛИШЕ на сервері, ніколи у клієнтському коді
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Отримати список вантажівок із останніми позиціями
const { data: trucks } = await supabaseAdmin
  .from('trucks_latest_position')
  .select('*')
  .eq('carrier_id', carrierId);
```

---

## Інтеграція з Node.js ORM

### TypeORM

```typescript
// entities/Message.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Chat } from './Chat';
import { Profile } from './Profile';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  chat: Chat;

  @Column({ name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => Profile)
  sender: Profile;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ nullable: true })
  content: string;

  @Column({ name: 'media_url', nullable: true })
  mediaUrl: string;

  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'read_at', nullable: true })
  readAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### Sequelize

```typescript
// models/Message.js
const { Model, DataTypes } = require('sequelize');

class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    chatId: { type: DataTypes.UUID, allowNull: false, field: 'chat_id' },
    senderId: { type: DataTypes.UUID, allowNull: false, field: 'sender_id' },
    content: { type: DataTypes.TEXT },
    mediaUrl: { type: DataTypes.TEXT, field: 'media_url' },
    senderType: {
      type: DataTypes.ENUM('customer', 'carrier', 'system'),
      field: 'sender_type',
    },
    deliveredAt: { type: DataTypes.DATE, field: 'delivered_at' },
    readAt: { type: DataTypes.DATE, field: 'read_at' },
    deletedAt: { type: DataTypes.DATE, field: 'deleted_at' },
    createdAt: { type: DataTypes.DATE, field: 'created_at' },
  },
  { sequelize, tableName: 'messages', timestamps: false }
);

// Зв'язки
Message.belongsTo(Chat, { foreignKey: 'chatId' });
Message.belongsTo(Profile, { as: 'sender', foreignKey: 'senderId' });
```

### Prisma

```prisma
// schema.prisma (фрагмент)

model Message {
  id          String    @id @default(uuid()) @db.Uuid
  chatId      String    @map("chat_id") @db.Uuid
  senderId    String    @map("sender_id") @db.Uuid
  content     String?
  mediaUrl    String?   @map("media_url")
  mediaType   String?   @map("media_type")
  senderType  String?   @map("sender_type")
  deliveredAt DateTime? @map("delivered_at")
  readAt      DateTime? @map("read_at")
  deletedAt   DateTime? @map("deleted_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  chat   Chat    @relation(fields: [chatId], references: [id], onDelete: Cascade)
  sender Profile @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([chatId, createdAt])
  @@index([senderId])
  @@map("messages")
}
```

---

## Корисні підказки щодо схеми

| Аспект | Рішення у схемі |
|---|---|
| Первинні ключі | UUID v4 (`uuid_generate_v4()`) — безпечно для розподілених систем |
| Часові мітки | `TIMESTAMPTZ` — зберігає часовий пояс, сумісний із JavaScript `Date` |
| М'яке видалення | `deleted_at TIMESTAMPTZ` — повідомлення не видаляються фізично |
| Мультирегіональність | `country_code CHAR(2)` (ISO 3166-1) + `language VARCHAR(10)` (BCP 47) |
| Повнотекстовий пошук | `TSVECTOR` з GIN-індексом у `cargo_requests` |
| Реальний час | `ALTER PUBLICATION supabase_realtime ADD TABLE …` для messages, tracking, chats |
| Безпека | RLS увімкнено на всіх таблицях; Node.js backend використовує `service_role` |
| ORM | Усі поля з `snake_case` назвами — стандарт для Sequelize/TypeORM/Prisma маппінгу |

---

## DevOps & масштабування

### 1) Partitioning / sharding strategy

Для TruckInfoX практичний підхід такий:

- Починати з **partitioning** (а не одразу sharding) для time-series та логів.
- Розглядати partitioning для таблиць `tracking`, `messages`, `activity_log`, `audit_log`, коли:
  - обсяг перевищує ~10M+ рядків на таблицю, або
  - запити по часу/архіву системно сповільнюються.
- Типовий варіант: `RANGE PARTITION BY created_at/recorded_at` (місячні партиції).
- **Sharding** додавати тільки якщо один Postgres-вузол уже не тримає навантаження по CPU/IO/latency навіть після індексів, partitioning і read-replica.
- Для sharding використовувати чіткий shard key (наприклад, `country_code` або хеш від `request_id`) і не розбивати транзакційно щільно пов'язані дані без крайньої потреби.

Готовий staging-playbook для місячного partitioning `tracking` + `messages`:
[supabase/snippets/partitioning_tracking_messages_monthly.sql](snippets/partitioning_tracking_messages_monthly.sql)

### 2) EXPLAIN ANALYZE для ключових запитів

Готовий набір перевірок знаходиться у [supabase/snippets/explain_analyze_key_queries.sql](snippets/explain_analyze_key_queries.sql).

Рекомендований процес:

1. Запускати на staging з даними, близькими до production.
2. Для кожного запиту виконувати 3 прогони (cold + warm cache).
3. Фіксувати:
   - `Execution Time`
   - тип скану (`Index Scan` vs `Seq Scan`)
   - `Buffers` (shared hit/read)
4. Якщо запит переходить у `Seq Scan` на великих таблицях — перевірити селективність фільтрів та складені індекси.

### 3) Storage policy: only owner or admin

Для bucket-ів користувацького медіа (`avatars`, `cargo`, `trucks`) використовується policy-патерн owner/admin:

```sql
CREATE POLICY "Users can access their media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('avatars', 'cargo', 'trucks')
  AND (
    public.is_admin()
    OR owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
```

Це поєднує перевірку `owner` з fallback на user-folder path для legacy об'єктів.

---

## Firebase → Supabase mapping (TruckinFox)

| Firebase collection | Supabase table/view |
|---|---|
| `users` | `profiles` (та сумісний `users` view) |
| `cargo_requests` | `cargo_requests` |
| `bids` | `bids` |
| `orders` | `orders` |
| `messages` | `messages` |
| `typing_indicators` | `typing_indicators` |
| `notifications` | `notifications` |
| `reviews` | `reviews` |
| `payments` | `payments` |
| `escrow_payments` | `escrow_payments` |
| `user_favorites` | `user_favorites` |
| `deliveries` | `deliveries` |

### Чому це Node.js-friendly

- UUID PK/FK + `TIMESTAMPTZ` для стабільної роботи з Sequelize/TypeORM/Prisma.
- `snake_case` поля без «магії» для прозорого мапінгу моделей.
- `JSONB metadata/data` для еволюції схеми без частих міграцій.
- Окремі таблиці `orders/payments/escrow_payments` для чистої доменної логіки на backend.
- RLS для клієнта + `service_role` для серверних воркерів/cron/API.

---

## Self-host Supabase через Docker

### Локально / staging

```bash
supabase start
supabase db reset
```

Після цього застосуйте ваші env у мобільному застосунку:

- `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status-or-dashboard>`

### Продакшн на власному сервері

- Розгорніть офіційний Supabase self-host stack (Docker Compose) на Linux VM
- Налаштуйте TLS через Nginx/Caddy
- Тримайте `service_role` ключ тільки на Node.js backend
- У мобільний клієнт передавайте лише `anon` ключ

## Рекомендований порядок міграції TruckinFox

1. Залишити Firebase як primary у production
2. Підняти Supabase паралельно (dual-run)
3. Перенести realtime-модулі першими: `messages`, `tracking`, `notifications`
4. Перенести бізнес-сутності: `orders`, `payments`, `escrow_payments`
5. Перенести Auth останнім етапом
