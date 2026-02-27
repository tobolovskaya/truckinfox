DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Public read cargo'
	) THEN
		CREATE POLICY "Public read cargo"
		ON storage.objects
		FOR SELECT
		TO public
		USING (bucket_id = 'cargo');
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Users upload own cargo files'
	) THEN
		CREATE POLICY "Users upload own cargo files"
		ON storage.objects
		FOR INSERT
		TO authenticated
		WITH CHECK (
			bucket_id = 'cargo'
			AND (storage.foldername(name))[1] = auth.uid()::text
		);
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Users update own cargo files'
	) THEN
		CREATE POLICY "Users update own cargo files"
		ON storage.objects
		FOR UPDATE
		TO authenticated
		USING (
			bucket_id = 'cargo'
			AND (storage.foldername(name))[1] = auth.uid()::text
		)
		WITH CHECK (
			bucket_id = 'cargo'
			AND (storage.foldername(name))[1] = auth.uid()::text
		);
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Users delete own cargo files'
	) THEN
		CREATE POLICY "Users delete own cargo files"
		ON storage.objects
		FOR DELETE
		TO authenticated
		USING (
			bucket_id = 'cargo'
			AND (storage.foldername(name))[1] = auth.uid()::text
		);
	END IF;
END $$;
