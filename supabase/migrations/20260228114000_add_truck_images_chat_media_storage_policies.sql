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

DROP POLICY IF EXISTS "Owners and admins can read truck_images" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can upload truck_images" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can update truck_images" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can delete truck_images" ON storage.objects;

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

DROP POLICY IF EXISTS "Participants and admins can read chat_media" ON storage.objects;
DROP POLICY IF EXISTS "Participants and admins can upload chat_media" ON storage.objects;
DROP POLICY IF EXISTS "Participants and admins can update chat_media" ON storage.objects;
DROP POLICY IF EXISTS "Participants and admins can delete chat_media" ON storage.objects;

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

CREATE OR REPLACE FUNCTION public.delete_truck_storage_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.delete_message_storage_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
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
$fn$;
