INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
	('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
	('cargo', 'cargo', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
	public = EXCLUDED.public,
	file_size_limit = EXCLUDED.file_size_limit,
	allowed_mime_types = EXCLUDED.allowed_mime_types;
