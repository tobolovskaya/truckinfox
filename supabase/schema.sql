-- =============================================================================
-- TruckInfoX — Supabase (PostgreSQL) Schema
-- =============================================================================
-- Цей файл визначає повну схему бази даних для Supabase.
-- Призначений для використання з реальним чатом, відстеженням вантажівок,
-- запитами на вантаж та підтримкою Node.js backend (Sequelize / TypeORM).
--
-- Для застосування:
--   1. Відкрийте Supabase SQL Editor
--   2. Вставте весь вміст цього файлу і виконайте
--
-- Таблиці:
--   - profiles         : Розширені дані користувачів (посилання на auth.users)
--   - trucks           : Вантажівки перевізників
--   - cargo_requests   : Запити на перевезення вантажу
--   - bids             : Ставки перевізників на запити
--   - tracking         : GPS-позиції вантажівок у реальному часі
--   - chats            : Чат-сесії між користувачами
--   - messages         : Повідомлення у чатах
-- =============================================================================

-- ---------------------------------------------------------------------------
-- РОЗШИРЕННЯ
-- ---------------------------------------------------------------------------
-- uuid-ossp: генерація UUID v4 через uuid_generate_v4()
-- pgcrypto:  альтернативний генератор UUID через gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Сумісність: у деяких середовищах uuid_generate_v4() недоступна у search_path.
-- Даємо локальний shim на базі pgcrypto, щоб DEFAULT uuid_generate_v4() працював стабільно.
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid AS $$
  SELECT gen_random_uuid();
$$ LANGUAGE sql;

-- ---------------------------------------------------------------------------
-- УТИЛІТИ: автоматичне оновлення поля updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- УТИЛІТИ: перевірка прав адміністратора
-- ---------------------------------------------------------------------------
-- Повертає TRUE, якщо поточний автентифікований користувач є адміністратором
-- (profiles.is_admin = TRUE).  Функція запускається як SECURITY DEFINER, тому
-- запит до profiles завжди виконується від імені власника функції (postgres),
-- а не від імені поточного користувача. Це запобігає ескалації привілеїв.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    FALSE
  );
$$;

-- =============================================================================
-- ТАБЛИЦЯ: profiles
-- =============================================================================
-- Розширює стандартну таблицю Supabase auth.users.
-- Зберігає публічний профіль користувача: ім'я, тип акаунту, регіон тощо.
-- Node.js ORM: belongsTo(User) через id = auth.users.id
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  -- Первинний ключ збігається з UUID в auth.users
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ім'я для відображення та пошук
  full_name       TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,

  -- 'customer' — замовник; 'carrier' — перевізник
  user_type       TEXT NOT NULL DEFAULT 'customer'
                    CHECK (user_type IN ('customer', 'carrier')),

  -- Дані компанії (для перевізників)
  company_name    TEXT,
  org_number      TEXT,

  -- Мультирегіональна підтримка
  country_code    CHAR(2)  NOT NULL DEFAULT 'NO',   -- ISO 3166-1 alpha-2
  language        VARCHAR(10) NOT NULL DEFAULT 'nb', -- IETF BCP 47 (nb, en, uk …)

  -- Середній рейтинг користувача (0.0–5.0)
  rating          NUMERIC(3, 2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),

  -- Токени для push-сповіщень (Expo / FCM)
  push_token      TEXT,

  -- Адміністратор: TRUE лише для внутрішніх службових акаунтів.
  -- Змінюється виключно через service_role (backend/Edge Function).
  is_admin        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Автооновлення updated_at при кожному UPDATE
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Індекси для частих запитів
CREATE INDEX IF NOT EXISTS idx_profiles_user_type    ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_country_code ON public.profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin     ON public.profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_country_created ON public.profiles(country_code, created_at DESC);

-- =============================================================================
-- ТАБЛИЦЯ: trucks
-- =============================================================================
-- Зберігає дані про вантажівки перевізників.
-- Кожна вантажівка прив'язана до одного перевізника (carrier_id).
-- Node.js ORM: belongsTo(Profile, { foreignKey: 'carrier_id' })
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.trucks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Власник вантажівки (перевізник)
  carrier_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Технічні дані
  plate_number    TEXT NOT NULL,
  model           TEXT,
  year            SMALLINT,
  capacity_kg     INTEGER,             -- Вантажопідйомність у кг
  volume_m3       NUMERIC(8, 2),       -- Об'єм кузова у м³
  truck_type      TEXT DEFAULT 'standard'
                    CHECK (truck_type IN ('standard', 'refrigerated', 'flatbed', 'tanker', 'other')),

  -- Зображення вантажівки (шлях у Supabase Storage: trucks/{truck_id}/*)
  image_url       TEXT,

  -- Поточний статус
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'maintenance')),

  -- Мультирегіональна підтримка
  country_code    CHAR(2)  NOT NULL DEFAULT 'NO',
  home_city       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_trucks_updated_at
  BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_trucks_carrier_id   ON public.trucks(carrier_id);
CREATE INDEX IF NOT EXISTS idx_trucks_status        ON public.trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_country_code  ON public.trucks(country_code);
CREATE INDEX IF NOT EXISTS idx_trucks_created_at    ON public.trucks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trucks_carrier_created ON public.trucks(carrier_id, created_at DESC);

-- =============================================================================
-- ТАБЛИЦЯ: cargo_requests
-- =============================================================================
-- Запити на перевезення вантажу від замовників.
-- Відповідає структурі CargoRequest у Firebase (hooks/useCargoRequests.ts).
-- Node.js ORM: belongsTo(Profile, { foreignKey: 'customer_id' })
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cargo_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Замовник
  customer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Опис вантажу
  title           TEXT NOT NULL,
  description     TEXT,
  cargo_type      TEXT NOT NULL DEFAULT 'other',  -- automotive, construction, boats …
  weight_kg       NUMERIC(10, 2),
  dimensions      TEXT,

  -- Маршрут
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  from_lat        NUMERIC(10, 7),
  from_lng        NUMERIC(10, 7),
  to_lat          NUMERIC(10, 7),
  to_lng          NUMERIC(10, 7),
  distance_km     NUMERIC(10, 2),

  -- Дати
  pickup_date     DATE NOT NULL,
  delivery_date   DATE,

  -- Ціна
  price           NUMERIC(12, 2),
  price_type      TEXT DEFAULT 'fixed'
                    CHECK (price_type IN ('fixed', 'per_km', 'negotiable')),
  currency        CHAR(3) NOT NULL DEFAULT 'NOK',  -- ISO 4217

  -- Статус запиту
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'bidding', 'accepted', 'in_transit', 'delivered', 'cancelled')),

  -- Обраний перевізник (після прийняття ставки)
  accepted_bid_id UUID,

  -- Зображення вантажу (Supabase Storage: cargo/{request_id}/*)
  images          TEXT[],

  -- Мультирегіональна підтримка
  country_code    CHAR(2) NOT NULL DEFAULT 'NO',

  -- Пошукові терміни для повнотекстового пошуку
  search_tokens   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple',
      COALESCE(title, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(from_address, '') || ' ' ||
      COALESCE(to_address, '') || ' ' ||
      COALESCE(cargo_type, '')
    )
  ) STORED,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_cargo_requests_updated_at
  BEFORE UPDATE ON public.cargo_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cargo_requests_customer_id  ON public.cargo_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_cargo_requests_status       ON public.cargo_requests(status);
CREATE INDEX IF NOT EXISTS idx_cargo_requests_pickup_date  ON public.cargo_requests(pickup_date);
CREATE INDEX IF NOT EXISTS idx_cargo_requests_cargo_type   ON public.cargo_requests(cargo_type);
CREATE INDEX IF NOT EXISTS idx_cargo_requests_country_code ON public.cargo_requests(country_code);
CREATE INDEX IF NOT EXISTS idx_cargo_requests_search       ON public.cargo_requests USING GIN(search_tokens);

-- =============================================================================
-- ТАБЛИЦЯ: bids
-- =============================================================================
-- Ставки перевізників на запити вантажу.
-- Node.js ORM:
--   belongsTo(Profile, { foreignKey: 'carrier_id' })
--   belongsTo(CargoRequest, { foreignKey: 'request_id' })
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bids (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  request_id      UUID NOT NULL REFERENCES public.cargo_requests(id) ON DELETE CASCADE,
  carrier_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Пропозиція
  price           NUMERIC(12, 2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'NOK',
  estimated_days  SMALLINT,
  note            TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Один перевізник може подати лише одну ставку на один запит
  UNIQUE (request_id, carrier_id)
);

CREATE TRIGGER trg_bids_updated_at
  BEFORE UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Зовнішній ключ прийнятої ставки (після встановлення зв'язку)
ALTER TABLE public.cargo_requests
  ADD CONSTRAINT fk_cargo_requests_accepted_bid
  FOREIGN KEY (accepted_bid_id) REFERENCES public.bids(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_bids_request_id  ON public.bids(request_id);
CREATE INDEX IF NOT EXISTS idx_bids_carrier_id  ON public.bids(carrier_id);
CREATE INDEX IF NOT EXISTS idx_bids_status      ON public.bids(status);

-- =============================================================================
-- ТАБЛИЦЯ: tracking
-- =============================================================================
-- GPS-координати вантажівок у реальному часі.
-- Кожен рядок — одна позиція у певний момент часу.
-- Для відстеження активного замовлення додається request_id (опціонально).
-- Node.js ORM:
--   belongsTo(Truck, { foreignKey: 'truck_id' })
--   belongsTo(CargoRequest, { foreignKey: 'request_id' })
-- Realtime: підпишіться на INSERT у цій таблиці через Supabase Realtime
--           або через канал присутності (Presence channel) для live-оновлень.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  truck_id        UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,

  -- Прив'язка до активного замовлення (NULL якщо вантажівка їде без замовлення)
  request_id      UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,
  country_code    CHAR(2) NOT NULL DEFAULT 'NO',

  -- Координати
  latitude        NUMERIC(10, 7) NOT NULL,
  longitude       NUMERIC(10, 7) NOT NULL,
  location        GEOGRAPHY(POINT, 4326),
  altitude_m      NUMERIC(8, 2),
  accuracy_m      NUMERIC(8, 2),

  -- Рух
  speed_kmh       NUMERIC(6, 2),
  heading_deg     NUMERIC(5, 2),   -- 0–360 градусів

  -- Час запису координат (від GPS-пристрою або телефону)
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Індекс для швидкого отримання останньої позиції вантажівки
CREATE INDEX IF NOT EXISTS idx_tracking_truck_recorded ON public.tracking(truck_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_request_id    ON public.tracking(request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_country_recorded ON public.tracking(country_code, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_country_request_recorded ON public.tracking(country_code, request_id, recorded_at DESC)
  WHERE request_id IS NOT NULL;
-- Просторовий пошук за координатами (наближені вантажівки)
CREATE INDEX IF NOT EXISTS idx_tracking_coordinates   ON public.tracking(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_tracking_location_gist ON public.tracking USING GIST(location);

-- =============================================================================
-- ТАБЛИЦЯ: chats
-- =============================================================================
-- Чат-сесія між двома користувачами, прив'язана до запиту на вантаж.
-- Ідентифікатор чату формується детерміновано:
--   sorted(user_a_id, user_b_id) + '_' + request_id
-- Node.js ORM:
--   belongsTo(Profile, { as: 'userA', foreignKey: 'user_a_id' })
--   belongsTo(Profile, { as: 'userB', foreignKey: 'user_b_id' })
--   belongsTo(CargoRequest, { foreignKey: 'request_id' })
--   hasMany(Message, { foreignKey: 'chat_id' })
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Учасники (завжди зберігаються відсортовано: user_a_id < user_b_id за текстом)
  user_a_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Пов'язаний запит на вантаж
  request_id      UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,

  -- Кількість непрочитаних для кожного учасника (денормалізовано для швидкості)
  unread_a        INTEGER NOT NULL DEFAULT 0,
  unread_b        INTEGER NOT NULL DEFAULT 0,

  -- Останнє повідомлення (для відображення у списку чатів)
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,

  -- Чат не видаляється фізично — лише архівується
  archived_by_a   BOOLEAN NOT NULL DEFAULT FALSE,
  archived_by_b   BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Не можна мати два однакові чати між тими самими двома людьми і тим самим запитом
  UNIQUE (user_a_id, user_b_id, request_id),
  -- Учасники мають бути різними особами
  CHECK (user_a_id <> user_b_id)
);

CREATE TRIGGER trg_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_chats_user_a_id    ON public.chats(user_a_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_b_id    ON public.chats(user_b_id);
CREATE INDEX IF NOT EXISTS idx_chats_request_id   ON public.chats(request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON public.chats(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chats_created_at      ON public.chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_user_a_created  ON public.chats(user_a_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_user_b_created  ON public.chats(user_b_id, created_at DESC);

-- =============================================================================
-- ТАБЛИЦЯ: messages
-- =============================================================================
-- Окремі повідомлення всередині чату.
-- Відповідає структурі Message у CHAT_MIGRATION_GUIDE.md.
-- Node.js ORM:
--   belongsTo(Chat, { foreignKey: 'chat_id' })
--   belongsTo(Profile, { as: 'sender', foreignKey: 'sender_id' })
-- Realtime: підпишіться на INSERT у цій таблиці, фільтруючи за chat_id,
--           через Supabase Realtime для миттєвої доставки повідомлень.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  chat_id         UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Вміст повідомлення
  content         TEXT,

  -- Медіа-вкладення (Supabase Storage: chat/{chat_id}/{message_id}/*)
  media_url       TEXT,
  media_type      TEXT CHECK (media_type IN ('image', 'video', 'file', NULL)),

  -- Тип відправника для контексту
  sender_type     TEXT CHECK (sender_type IN ('customer', 'carrier', 'system')),

  -- Статус доставки
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,

  -- Повідомлення не видаляється фізично
  deleted_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Або текст, або медіа — хоча б одне повинно бути присутнє
  CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

-- Основний запит: всі повідомлення конкретного чату, відсортовані за часом
CREATE INDEX IF NOT EXISTS idx_messages_chat_id     ON public.messages(chat_id, created_at ASC);
-- Запит на непрочитані повідомлення для конкретного відправника
CREATE INDEX IF NOT EXISTS idx_messages_sender_id   ON public.messages(sender_id);
-- Запит на непрочитані повідомлення (read_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_messages_unread      ON public.messages(chat_id, read_at)
  WHERE read_at IS NULL AND deleted_at IS NULL;
-- Пагінація від новішого до старішого в межах чату
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_desc ON public.messages(chat_id, created_at DESC);
-- Для адмін-дашборду та аналітики
CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON public.messages(created_at DESC);

-- =============================================================================
-- СУМІСНІСТЬ CHAT-ПОТОКУ (поточний клієнт Firebase-style)
-- =============================================================================
-- Поточний RN-клієнт читає/пише messages через request_id + sender_id/receiver_id
-- без явного chat_id. Ці поля дають змогу мігрувати поступово.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_request_id_created_at
  ON public.messages(request_id, created_at ASC)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
  ON public.messages(receiver_id, request_id, read_at)
  WHERE receiver_id IS NOT NULL AND read_at IS NULL AND deleted_at IS NULL;

-- =============================================================================
-- ТАБЛИЦЯ: orders
-- =============================================================================
-- Замовлення створюється після прийняття ставки (або напряму).
-- Поля вирівняні з існуючим мобільним кодом: total_amount/platform_fee/carrier_amount,
-- status/payment_status, request_id, bid_id.
CREATE TABLE IF NOT EXISTS public.orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id          UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,
  bid_id              UUID REFERENCES public.bids(id) ON DELETE SET NULL,

  customer_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  carrier_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  total_amount        NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  platform_fee        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  carrier_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (carrier_amount >= 0),
  currency            CHAR(3) NOT NULL DEFAULT 'NOK',

  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('pending', 'active', 'in_transit', 'delivered', 'cancelled', 'disputed')),
  payment_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending', 'initiated', 'paid', 'failed', 'refunded', 'released')),

  started_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,

  delivery_photos     TEXT[],
  delivery_signature_url TEXT,
  completion_note     TEXT,

  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_carrier_created
  ON public.orders(carrier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_request_id ON public.orders(request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_bid_id ON public.orders(bid_id)
  WHERE bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- =============================================================================
-- ТАБЛИЦЯ: payments
-- =============================================================================
-- Історія платежів для екрану payment history.
CREATE TABLE IF NOT EXISTS public.payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,

  amount              NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency            CHAR(3) NOT NULL DEFAULT 'NOK',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method      TEXT NOT NULL DEFAULT 'vipps',
  description         TEXT,
  invoice_url         TEXT,
  reference_id        TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- =============================================================================
-- ТАБЛИЦЯ: escrow_payments
-- =============================================================================
-- Платіжний escrow lifecycle (initiated -> paid -> released/refunded).
CREATE TABLE IF NOT EXISTS public.escrow_payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  request_id          UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,
  bid_id              UUID REFERENCES public.bids(id) ON DELETE SET NULL,

  customer_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  carrier_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  total_amount        NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  platform_fee        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  carrier_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (carrier_amount >= 0),
  currency            CHAR(3) NOT NULL DEFAULT 'NOK',

  status              TEXT NOT NULL DEFAULT 'initiated'
                        CHECK (status IN ('initiated', 'paid', 'released', 'refunded', 'failed', 'expired')),
  provider            TEXT NOT NULL DEFAULT 'vipps',
  provider_order_id   TEXT,
  payment_url         TEXT,

  idempotency_key     TEXT NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (idempotency_key)
);

CREATE TRIGGER trg_escrow_payments_updated_at
  BEFORE UPDATE ON public.escrow_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_escrow_order_id ON public.escrow_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_customer_created
  ON public.escrow_payments(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_carrier_created
  ON public.escrow_payments(carrier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON public.escrow_payments(status);

-- =============================================================================
-- ТАБЛИЦЯ: user_favorites
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id          UUID NOT NULL REFERENCES public.cargo_requests(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_created
  ON public.user_favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_favorites_request_id ON public.user_favorites(request_id);

-- =============================================================================
-- ТАБЛИЦЯ: reviews
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  reviewer_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (reviewer_id <> reviewed_id),
  UNIQUE (order_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_created
  ON public.reviews(reviewed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_created
  ON public.reviews(reviewer_id, created_at DESC);

-- =============================================================================
-- ТАБЛИЦЯ: notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  type                TEXT NOT NULL
                        CHECK (type IN ('new_bid', 'bid_accepted', 'payment_success', 'order_status_change')),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,

  related_id          UUID,
  related_type        TEXT CHECK (related_type IN ('cargo_request', 'order', NULL)),

  read                BOOLEAN NOT NULL DEFAULT FALSE,
  read_at             TIMESTAMPTZ,

  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read, created_at DESC)
  WHERE read = FALSE;

-- =============================================================================
-- ТАБЛИЦЯ: deliveries
-- =============================================================================
-- Поточний клієнт читає документ deliveries/{order_id}. У SQL тримаємо 1:1 рядок на order_id.
CREATE TABLE IF NOT EXISTS public.deliveries (
  order_id             UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,

  current_latitude     NUMERIC(10, 7),
  current_longitude    NUMERIC(10, 7),
  route                JSONB,

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ТАБЛИЦЯ: typing_indicators
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  request_id          UUID NOT NULL REFERENCES public.cargo_requests(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  typing              BOOLEAN NOT NULL DEFAULT FALSE,
  "timestamp"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_request_timestamp
  ON public.typing_indicators(request_id, "timestamp" DESC);

-- =============================================================================
-- СУМІСНІСТЬ ІМЕН: users (view)
-- =============================================================================
-- Firebase-код використовує колекцію users. Для SQL зберігаємо canonical таблицю
-- profiles та надаємо read-only view users для простішої міграції.
CREATE OR REPLACE VIEW public.users AS
SELECT
  p.id,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.user_type,
  p.company_name,
  p.org_number,
  p.country_code,
  p.language,
  p.rating,
  p.push_token,
  p.created_at,
  p.updated_at
FROM public.profiles p;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- RLS гарантує, що кожен користувач може бачити лише свої дані.
-- Для Node.js backend: використовуйте service_role ключ для обходу RLS.
-- Для frontend Supabase клієнта: RLS застосовується автоматично.

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles: лише authenticated читають профілі, оновлюють лише свій
-- ---------------------------------------------------------------------------
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- trucks: лише власник читає/змінює; адмін — повний доступ
-- ---------------------------------------------------------------------------
CREATE POLICY "Carriers can view their trucks"
  ON public.trucks FOR SELECT
  USING (auth.uid() = carrier_id);

CREATE POLICY "Carriers can insert their trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (auth.uid() = carrier_id);

CREATE POLICY "Carriers can update their trucks"
  ON public.trucks FOR UPDATE
  USING (auth.uid() = carrier_id);

CREATE POLICY "Carriers can delete their trucks"
  ON public.trucks FOR DELETE
  USING (auth.uid() = carrier_id);

-- Адміністратор може виконувати будь-які операції (модерація, GDPR)
CREATE POLICY "Admins have full access to trucks"
  ON public.trucks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- cargo_requests: лише authenticated читають; лише замовник змінює свої
-- ---------------------------------------------------------------------------
CREATE POLICY "Authenticated users can view cargo requests"
  ON public.cargo_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Customers can create cargo requests"
  ON public.cargo_requests FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their cargo requests"
  ON public.cargo_requests FOR UPDATE
  USING (auth.uid() = customer_id);

-- ---------------------------------------------------------------------------
-- bids: перевізник бачить свої ставки; замовник бачить ставки на свої запити
-- ---------------------------------------------------------------------------
CREATE POLICY "Carriers can view and manage their bids"
  ON public.bids FOR ALL
  USING (auth.uid() = carrier_id);

CREATE POLICY "Customers can view bids on their requests"
  ON public.bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo_requests cr
      WHERE cr.id = request_id AND cr.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tracking: перевізник пише свої позиції; замовник активного замовлення читає
-- ---------------------------------------------------------------------------
CREATE POLICY "Carriers can insert tracking for their trucks"
  ON public.tracking FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trucks t
      WHERE t.id = truck_id AND t.carrier_id = auth.uid()
    )
  );

CREATE POLICY "Carriers can view their own tracking"
  ON public.tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trucks t
      WHERE t.id = truck_id AND t.carrier_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view tracking for their active requests"
  ON public.tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo_requests cr
      WHERE cr.id = request_id AND cr.customer_id = auth.uid()
        AND cr.status = 'in_transit'
    )
  );

-- ---------------------------------------------------------------------------
-- chats: лише учасники чату мають доступ; адмін — повний доступ
-- ---------------------------------------------------------------------------
CREATE POLICY "Chat participants can view their chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Authenticated users can create chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Chat participants can update their chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Адміністратор: повний доступ (розгляд скарг, GDPR-розслідування)
CREATE POLICY "Admins have full access to chats"
  ON public.chats FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- messages: лише учасники відповідного чату мають доступ; адмін — повний
-- ---------------------------------------------------------------------------
CREATE POLICY "Chat participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Sender can update their messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Receiver can mark messages as read"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
        AND auth.uid() <> sender_id
    )
  );

-- Адміністратор: повний доступ (видалення незаконного контенту, GDPR)
CREATE POLICY "Admins have full access to messages"
  ON public.messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- orders / payments / escrow
-- ---------------------------------------------------------------------------
CREATE POLICY "Order participants can view orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = carrier_id);

CREATE POLICY "Customers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Order participants can update orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = customer_id OR auth.uid() = carrier_id);

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own escrow payments"
  ON public.escrow_payments FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = carrier_id);

CREATE POLICY "Customers can create escrow payments"
  ON public.escrow_payments FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Escrow participants can update escrow state"
  ON public.escrow_payments FOR UPDATE
  USING (auth.uid() = customer_id OR auth.uid() = carrier_id);

-- ---------------------------------------------------------------------------
-- favorites / reviews / notifications
-- ---------------------------------------------------------------------------
CREATE POLICY "Users can manage own favorites"
  ON public.user_favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can view reviews where they are involved"
  ON public.reviews FOR SELECT
  USING (auth.uid() = reviewer_id OR auth.uid() = reviewed_id);

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- deliveries / typing indicators
-- ---------------------------------------------------------------------------
CREATE POLICY "Order participants can view delivery"
  ON public.deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.customer_id = auth.uid() OR o.carrier_id = auth.uid())
    )
  );

CREATE POLICY "Carrier can upsert delivery"
  ON public.deliveries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.carrier_id = auth.uid()
    )
  );

CREATE POLICY "Carrier can update delivery"
  ON public.deliveries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.carrier_id = auth.uid()
    )
  );

CREATE POLICY "Users can view typing indicators for request they belong to"
  ON public.typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo_requests cr
      WHERE cr.id = request_id
        AND (
          cr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.bids b
            WHERE b.request_id = cr.id AND b.carrier_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Users can manage own typing indicators"
  ON public.typing_indicators FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- SUPABASE REALTIME
-- =============================================================================
-- Увімкніть Realtime для таблиць, які потребують живих оновлень.
-- Виконайте у Supabase Dashboard → Database → Replication,
-- або застосуйте ці команди:

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

-- =============================================================================
-- АВТОМАТИЧНЕ СТВОРЕННЯ ПРОФІЛЮ ПІСЛЯ РЕЄСТРАЦІЇ
-- =============================================================================
-- Цей тригер автоматично створює рядок у profiles при реєстрації нового
-- користувача через Supabase Auth (будь-який провайдер: email, Google тощо).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    avatar_url,
    user_type,
    company_name,
    org_number
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'user_type', ''), 'customer'),
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'org_number', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name    = EXCLUDED.full_name,
    phone        = EXCLUDED.phone,
    avatar_url   = EXCLUDED.avatar_url,
    user_type    = EXCLUDED.user_type,
    company_name = EXCLUDED.company_name,
    org_number   = EXCLUDED.org_number,
    updated_at   = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ДОПОМІЖНІ ФУНКЦІЇ / VIEWS
-- =============================================================================

-- Останнє місцезнаходження кожної вантажівки (зручно для карти)
CREATE OR REPLACE VIEW public.trucks_latest_position AS
SELECT DISTINCT ON (tr.truck_id)
  tr.truck_id,
  t.plate_number,
  t.carrier_id,
  p.full_name AS carrier_name,
  tr.latitude,
  tr.longitude,
  tr.speed_kmh,
  tr.heading_deg,
  tr.request_id,
  tr.recorded_at
FROM public.tracking tr
JOIN public.trucks   t ON t.id = tr.truck_id
JOIN public.profiles p ON p.id = t.carrier_id
ORDER BY tr.truck_id, tr.recorded_at DESC;

-- Кількість непрочитаних повідомлень для поточного користувача
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.messages m
  JOIN public.chats    c ON c.id = m.chat_id
  WHERE m.sender_id <> p_user_id
    AND m.read_at IS NULL
    AND m.deleted_at IS NULL
    AND (c.user_a_id = p_user_id OR c.user_b_id = p_user_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- ТАБЛИЦЯ: truck_tracking (VIEW alias for tracking)
-- =============================================================================
-- Псевдонім таблиці tracking для ORM-сумісності та специфікації API.
-- Inherits RLS from the underlying tracking table.
-- =============================================================================
CREATE OR REPLACE VIEW public.truck_tracking AS
SELECT
  id,
  truck_id,
  request_id,
  country_code,
  latitude,
  longitude,
  altitude_m,
  accuracy_m,
  speed_kmh,
  heading_deg,
  recorded_at,
  created_at
FROM public.tracking;

-- =============================================================================
-- ТАБЛИЦЯ: chat_participants
-- =============================================================================
-- Нормалізований список учасників кожного чату.
-- Синхронізується автоматично з chats.user_a_id / user_b_id через тригер.
-- Дає змогу в майбутньому розширитися до групових чатів без змін у chats.
-- Node.js ORM:
--   belongsTo(Chat,    { foreignKey: 'chat_id' })
--   belongsTo(Profile, { foreignKey: 'user_id' })
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_participants (
  chat_id      UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 'member' — звичайний учасник; 'admin' — зарезервовано для модерації
  role         TEXT NOT NULL DEFAULT 'member'
                 CHECK (role IN ('member', 'admin')),

  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Курсор читання для лічильника непрочитаних
  last_read_at TIMESTAMPTZ,

  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id
  ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id
  ON public.chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_joined
  ON public.chat_participants(chat_id, joined_at DESC);

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat participations"
  ON public.chat_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Chat members can view all participants in their chats"
  ON public.chat_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can join chats"
  ON public.chat_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants can update their own membership"
  ON public.chat_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Тригер: автоматично заповнює chat_participants при створенні нового чату
CREATE OR REPLACE FUNCTION public.sync_chat_participants()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (NEW.id, NEW.user_a_id), (NEW.id, NEW.user_b_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_chat_participants ON public.chats;
CREATE TRIGGER trg_sync_chat_participants
  AFTER INSERT ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.sync_chat_participants();

-- =============================================================================
-- SUPABASE STORAGE — ДОДАТКОВІ КОШИКИ
-- =============================================================================

-- Кошик: trucks (зображення вантажівок, публічний)
-- Шлях: trucks/{user_id}/{truck_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trucks', 'trucks', false, 10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Кошик: chat (медіа-вкладення у чаті, приватний)
-- Шлях: chat/{chat_id}/{message_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat', 'chat', false, 52428800,
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Кошик: truck_images (рекомендований, приватний)
-- Шлях: truck_images/{country_code}/{truck_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'truck_images', 'truck_images', false, 10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Кошик: chat_media (рекомендований, приватний)
-- Шлях: chat_media/{chat_id}/{message_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_media', 'chat_media', false, 52428800,
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: trucks
CREATE POLICY "Carriers read own truck images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trucks'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "Carriers upload own truck images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trucks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Carriers update own truck images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'trucks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'trucks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Carriers delete own truck images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trucks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies: chat (participant-scoped)
CREATE POLICY "Chat participants can read chat files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat'
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat'
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Users delete own chat files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat'
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- Storage policies: truck_images (owner/admin only)
CREATE POLICY "Owners and admins can read truck_images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'truck_images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.carrier_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners and admins can upload truck_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'truck_images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.carrier_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners and admins can update truck_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'truck_images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.carrier_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'truck_images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.carrier_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners and admins can delete truck_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'truck_images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.carrier_id = auth.uid()
      )
    )
  );

-- Storage policies: chat_media (participants/admin only)
CREATE POLICY "Participants and admins can read chat_media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat_media'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
      )
    )
  );

CREATE POLICY "Participants and admins can upload chat_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat_media'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
      )
    )
  );

CREATE POLICY "Participants and admins can update chat_media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat_media'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'chat_media'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
      )
    )
  );

CREATE POLICY "Participants and admins can delete chat_media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat_media'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
      )
    )
  );

-- =============================================================================
-- ТАБЛИЦЯ: audit_log (GDPR / відповідність вимогам безпеки)
-- =============================================================================
-- Append-only журнал чутливих мутацій. Доступний лише для service_role та
-- SECURITY DEFINER функцій. Клієнти (anon / authenticated) не мають доступу.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Хто виконав дію (NULL якщо користувача видалено)
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Тип дії: 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'PASSWORD_RESET' тощо
  action      TEXT NOT NULL,

  -- Цільова таблиця і первинний ключ зміненого рядка
  table_name  TEXT,
  record_id   UUID,

  -- Знімки даних до/після для аудиту змін
  old_data    JSONB,
  new_data    JSONB,

  -- Метадані запиту (заповнюється backend / Edge Function)
  ip_address  INET,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: без permissive policy для authenticated/anon → доступ заблоковано.
-- service_role обходить RLS автоматично.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON public.audit_log(table_name, record_id)
  WHERE table_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log(created_at DESC);

-- =============================================================================
-- RLS: виправлення для messages (legacy request_id / receiver_id шлях)
-- =============================================================================
-- Оригінальні policies перевіряють доступ лише через chat_id.
-- Клієнти, що ще не мігрували на chat_id, використовують поле request_id.
-- Ці додаткові policies закривають прогалину в безпеці.
-- =============================================================================
CREATE POLICY "Chat participants can view messages via request"
  ON public.messages FOR SELECT
  USING (
    request_id IS NOT NULL
    AND chat_id IS NULL
    AND (
      auth.uid() = sender_id
      OR auth.uid() = receiver_id
      OR EXISTS (
        SELECT 1 FROM public.cargo_requests cr
        WHERE cr.id = request_id
          AND (
            cr.customer_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.bids b
              WHERE b.request_id = cr.id AND b.carrier_id = auth.uid()
            )
          )
      )
    )
  );

CREATE POLICY "Users can send messages via request"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND request_id IS NOT NULL
    AND chat_id IS NULL
  );

-- =============================================================================
-- ДОДАТКОВІ ІНДЕКСИ ДЛЯ ПРОДУКТИВНОСТІ
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_media_type
  ON public.messages(media_type)
  WHERE media_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_request_status
  ON public.bids(request_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_metadata
  ON public.orders USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_escrow_metadata
  ON public.escrow_payments USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_notifications_unread_push
  ON public.notifications(user_id, created_at DESC)
  WHERE read = FALSE;

-- =============================================================================
-- ТРИГЕРИ: видалення медіа-файлів зі Storage при видаленні рядків
-- =============================================================================
-- При жорсткому видаленні рядка trucks або messages відповідні об'єкти
-- автоматично видаляються з кошиків Supabase Storage.
-- Обидві функції запускаються як SECURITY DEFINER, щоб мати право
-- виконувати DELETE FROM storage.objects навіть з обмеженого контексту.
--
-- Права на видалення (GDPR — право на забуття):
--   trucks  → bucket 'trucks', шлях: {carrier_id}/{truck_id}/{filename}
--   messages → bucket 'chat',  шлях: {chat_id}/{message_id}/{filename}
-- =============================================================================

-- Функція очищення Storage для вантажівок
CREATE OR REPLACE FUNCTION public.delete_truck_storage_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'trucks'
    AND name LIKE (OLD.carrier_id::text || '/' || OLD.id::text || '/%');

  DELETE FROM storage.objects
  WHERE bucket_id = 'truck_images'
    AND (
      name LIKE ('%/' || OLD.id::text || '/%')
      OR name LIKE (OLD.id::text || '/%')
    );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_truck_media ON public.trucks;
CREATE TRIGGER trg_delete_truck_media
  AFTER DELETE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.delete_truck_storage_media();

-- Функція очищення Storage для повідомлень
CREATE OR REPLACE FUNCTION public.delete_message_storage_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.media_url IS NOT NULL THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'chat'
      AND name LIKE (OLD.chat_id::text || '/' || OLD.id::text || '/%');

    DELETE FROM storage.objects
    WHERE bucket_id = 'chat_media'
      AND name LIKE (OLD.chat_id::text || '/' || OLD.id::text || '/%');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_message_media ON public.messages;
CREATE TRIGGER trg_delete_message_media
  AFTER DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.delete_message_storage_media();

-- =============================================================================
-- ТАБЛИЦЯ: activity_log (журнал подій застосунку)
-- =============================================================================
-- Фіксує події рівня застосунку: 'truck.created', 'order.status_changed' тощо.
-- Відрізняється від audit_log (безпека/GDPR): тут нема знімків old/new_data.
--
-- Записувати можуть лише Edge Functions та backend-сервіси (service_role).
-- Звичайні клієнти (anon / authenticated) не мають доступу через RLS.
--
-- GDPR: user_id → SET NULL при видаленні профілю (анонімізація).
-- Тривалість зберігання: рекомендовано 2 роки; очищення через scheduled job.
--
-- Приклад виклику:
--   SELECT public.log_activity(
--     auth.uid(),
--     'truck.created',
--     'trucks',
--     '550e8400-e29b-41d4-a716-446655440000'::uuid,
--     '{"plate_number": "AB12345"}'::jsonb
--   );
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Актор (NULL після видалення акаунту — GDPR-анонімізація)
  user_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Ім'я події у форматі 'сутність.дія', наприклад 'order.status_changed'
  action       TEXT        NOT NULL,

  -- Яка таблиця / доменна сутність пов'язана з подією
  entity_type  TEXT,
  entity_id    UUID,

  -- Довільний структурований payload (без чутливих персональних даних)
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
-- Навмисно немає permissive policy для authenticated/anon.
-- service_role обходить RLS автоматично.

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON public.activity_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON public.activity_log(entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON public.activity_log(created_at DESC);

-- Хелпер: записати одну подію з будь-якого SQL-контексту.
-- Параметри:
--   p_user_id     — актор (NULL для системних подій)
--   p_action      — ім'я події ('truck.created', 'message.deleted' тощо)
--   p_entity_type — назва таблиці ('trucks', 'messages' тощо), необов'язково
--   p_entity_id   — первинний ключ зміненого рядка, необов'язково
--   p_metadata    — довільний JSON-payload
-- Повертає UUID нового запису.
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id     UUID,
  p_action      TEXT,
  p_entity_type TEXT    DEFAULT NULL,
  p_entity_id   UUID    DEFAULT NULL,
  p_metadata    JSONB   DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Сумісний хелпер для вимоги fn_insert_log(user_id, action, table_name, row_id, details).
-- Делегує запис у activity_log через log_activity().
CREATE OR REPLACE FUNCTION public.fn_insert_log(
  p_user_id    UUID,
  p_action     TEXT,
  p_table_name TEXT,
  p_row_id     UUID,
  p_details    JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.log_activity(
    p_user_id,
    p_action,
    p_table_name,
    p_row_id,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

-- Тригер-хелпер для автоматичного activity_log на ключових таблицях.
CREATE OR REPLACE FUNCTION public.fn_insert_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id      UUID;
  v_action       TEXT;
  v_table_name   TEXT;
  v_row_id_text  TEXT;
  v_row_id       UUID;
  v_details      JSONB;
  v_new_data     JSONB;
  v_old_data     JSONB;
BEGIN
  v_user_id := auth.uid();
  v_table_name := TG_TABLE_NAME;
  v_action := lower(TG_TABLE_NAME) || '.' || lower(TG_OP);

  v_new_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  v_old_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;

  v_row_id_text := COALESCE(
    v_new_data ->> 'id',
    v_new_data ->> 'order_id',
    v_old_data ->> 'id',
    v_old_data ->> 'order_id'
  );

  BEGIN
    v_row_id := CASE WHEN v_row_id_text IS NULL OR v_row_id_text = '' THEN NULL ELSE v_row_id_text::uuid END;
  EXCEPTION
    WHEN OTHERS THEN
      v_row_id := NULL;
  END;

  v_details := jsonb_build_object(
    'operation', TG_OP,
    'table', TG_TABLE_NAME
  );

  IF (v_new_data ? 'status') OR (v_old_data ? 'status') THEN
    v_details := v_details || jsonb_build_object(
      'old_status', v_old_data ->> 'status',
      'new_status', v_new_data ->> 'status'
    );
  END IF;

  PERFORM public.fn_insert_log(v_user_id, v_action, v_table_name, v_row_id, v_details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_log_cargo_requests ON public.cargo_requests;
CREATE TRIGGER trg_activity_log_cargo_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.cargo_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_bids ON public.bids;
CREATE TRIGGER trg_activity_log_bids
  AFTER INSERT OR UPDATE OR DELETE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_orders ON public.orders;
CREATE TRIGGER trg_activity_log_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_payments ON public.payments;
CREATE TRIGGER trg_activity_log_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_escrow_payments ON public.escrow_payments;
CREATE TRIGGER trg_activity_log_escrow_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.escrow_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_deliveries ON public.deliveries;
CREATE TRIGGER trg_activity_log_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

-- =============================================================================
-- STORAGE: АДМІН-ПОЛІТИКИ ДЛЯ КОШИКІВ
-- =============================================================================
-- Адміністратори платформи повинні мати повний доступ до всіх кошиків для:
--   - модерації незаконного контенту
--   - виконання GDPR-запитів на видалення
--   - відновлення з резервних копій
--
-- Рекомендація: для максимальної безпеки зберігати файли у приватних кошиках
-- та надавати підписані URL (signed URLs) з коротким TTL замість публічного доступу.
-- =============================================================================

CREATE POLICY "Admins have full access to trucks bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'trucks'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'trucks'
    AND public.is_admin()
  );

CREATE POLICY "Admins have full access to chat bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'chat'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'chat'
    AND public.is_admin()
  );

CREATE POLICY "Admins have full access to avatars bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.is_admin()
  );

CREATE POLICY "Admins have full access to cargo bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'cargo'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'cargo'
    AND public.is_admin()
  );

CREATE POLICY "Users can access their media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('avatars', 'cargo', 'trucks')
    AND (
      public.is_admin()
      OR owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
