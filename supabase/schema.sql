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

  -- Координати
  latitude        NUMERIC(10, 7) NOT NULL,
  longitude       NUMERIC(10, 7) NOT NULL,
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
-- Просторовий пошук за координатами (наближені вантажівки)
CREATE INDEX IF NOT EXISTS idx_tracking_coordinates   ON public.tracking(latitude, longitude);

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

-- ---------------------------------------------------------------------------
-- profiles: кожен читає будь-який профіль, оновлює лише свій
-- ---------------------------------------------------------------------------
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- trucks: всі можуть читати; лише власник змінює
-- ---------------------------------------------------------------------------
CREATE POLICY "Trucks are viewable by everyone"
  ON public.trucks FOR SELECT USING (true);

CREATE POLICY "Carriers can insert their trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (auth.uid() = carrier_id);

CREATE POLICY "Carriers can update their trucks"
  ON public.trucks FOR UPDATE
  USING (auth.uid() = carrier_id);

CREATE POLICY "Carriers can delete their trucks"
  ON public.trucks FOR DELETE
  USING (auth.uid() = carrier_id);

-- ---------------------------------------------------------------------------
-- cargo_requests: всі читають відкриті; лише замовник змінює свої
-- ---------------------------------------------------------------------------
CREATE POLICY "Cargo requests are viewable by everyone"
  ON public.cargo_requests FOR SELECT USING (true);

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
-- chats: лише учасники чату мають доступ
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

-- ---------------------------------------------------------------------------
-- messages: лише учасники відповідного чату мають доступ
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

-- =============================================================================
-- SUPABASE REALTIME
-- =============================================================================
-- Увімкніть Realtime для таблиць, які потребують живих оновлень.
-- Виконайте у Supabase Dashboard → Database → Replication,
-- або застосуйте ці команди:

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- =============================================================================
-- АВТОМАТИЧНЕ СТВОРЕННЯ ПРОФІЛЮ ПІСЛЯ РЕЄСТРАЦІЇ
-- =============================================================================
-- Цей тригер автоматично створює рядок у profiles при реєстрації нового
-- користувача через Supabase Auth (будь-який провайдер: email, Google тощо).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  );
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
