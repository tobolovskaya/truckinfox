INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
	('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
	('cargo', 'cargo', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Public read avatars'
	) THEN
		CREATE POLICY "Public read avatars"
		ON storage.objects
		FOR SELECT
		TO public
		USING (bucket_id = 'avatars');
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Users upload own avatars'
	) THEN
		CREATE POLICY "Users upload own avatars"
		ON storage.objects
		FOR INSERT
		TO authenticated
		WITH CHECK (
			bucket_id = 'avatars'
			AND (storage.foldername(name))[1] = auth.uid()::text
		);
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Users update own avatars'
	) THEN
		CREATE POLICY "Users update own avatars"
		ON storage.objects
		FOR UPDATE
		TO authenticated
		USING (
			bucket_id = 'avatars'
			AND (storage.foldername(name))[1] = auth.uid()::text
		)
		WITH CHECK (
			bucket_id = 'avatars'
			AND (storage.foldername(name))[1] = auth.uid()::text
		);
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Users delete own avatars'
	) THEN
		CREATE POLICY "Users delete own avatars"
		ON storage.objects
		FOR DELETE
		TO authenticated
		USING (
			bucket_id = 'avatars'
			AND (storage.foldername(name))[1] = auth.uid()::text
		);
	END IF;
END $$;
