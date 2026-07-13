-- Private bucket for uploaded match screenshots. The API (service role key)
-- is the only writer/reader; organizers never get a direct signed URL to it,
-- so no public storage policies are needed. Image-only and size-capped at the
-- bucket level as defense-in-depth — the upload route itself doesn't enforce
-- either (see app/services/upload_service.py).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
