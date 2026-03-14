-- Migration: 00042_make_bike_photos_bucket_public
-- Purpose: The bike-photos bucket was created as private (public=false), but the
--          mobile app uses getPublicUrl() to generate photo URLs stored in
--          primary_photo_url. These URLs return 400/403 because the bucket is
--          private. Making it public so stored URLs are accessible.
--          RLS policies still protect upload/update/delete operations.

UPDATE storage.buckets
SET public = true
WHERE id = 'bike-photos';
