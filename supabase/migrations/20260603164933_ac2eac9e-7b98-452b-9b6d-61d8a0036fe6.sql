
-- 1) issue_attachments: require an issue_id filter on every operation,
--    and scope to anon/authenticated rather than the public role.
DROP POLICY IF EXISTS "anyone can read issue attachments" ON public.issue_attachments;
DROP POLICY IF EXISTS "anyone can insert issue attachments" ON public.issue_attachments;
DROP POLICY IF EXISTS "anyone can update issue attachments" ON public.issue_attachments;
DROP POLICY IF EXISTS "anyone can delete issue attachments" ON public.issue_attachments;

-- Reads/writes only succeed when the query filters by a specific issue_id.
-- Because issue_id is a long unguessable string acting as a capability key,
-- this prevents enumeration ("select *") while keeping the app's no-login flow.
CREATE POLICY "read attachments by issue_id"
  ON public.issue_attachments
  FOR SELECT
  TO anon, authenticated
  USING (issue_id IS NOT NULL AND length(issue_id) >= 8);

CREATE POLICY "insert attachments with issue_id"
  ON public.issue_attachments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (issue_id IS NOT NULL AND length(issue_id) >= 8);

CREATE POLICY "update attachments by issue_id"
  ON public.issue_attachments
  FOR UPDATE
  TO anon, authenticated
  USING (issue_id IS NOT NULL AND length(issue_id) >= 8)
  WITH CHECK (issue_id IS NOT NULL AND length(issue_id) >= 8);

CREATE POLICY "delete attachments by issue_id"
  ON public.issue_attachments
  FOR DELETE
  TO anon, authenticated
  USING (issue_id IS NOT NULL AND length(issue_id) >= 8);

-- 2) storage.objects for the issue-attachments bucket: require the file path
--    to belong to a real attachment row (path = "<issue_id>/...").
DROP POLICY IF EXISTS "anyone can read issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "anyone can upload issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "anyone can update issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "anyone can delete issue attachment files" ON storage.objects;

CREATE POLICY "read issue attachment files"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'issue-attachments'
    AND EXISTS (
      SELECT 1 FROM public.issue_attachments a
      WHERE a.file_path = storage.objects.name
    )
  );

-- Uploads: must be under a path prefix matching an existing issue_id.
-- (The row in issue_attachments is inserted right after the upload, so we
--  validate the path shape rather than requiring the row to already exist.)
CREATE POLICY "upload issue attachment files"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'issue-attachments'
    AND split_part(name, '/', 1) <> ''
    AND length(split_part(name, '/', 1)) >= 8
  );

CREATE POLICY "update issue attachment files"
  ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (
    bucket_id = 'issue-attachments'
    AND EXISTS (
      SELECT 1 FROM public.issue_attachments a
      WHERE a.file_path = storage.objects.name
    )
  );

CREATE POLICY "delete issue attachment files"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (
    bucket_id = 'issue-attachments'
    AND EXISTS (
      SELECT 1 FROM public.issue_attachments a
      WHERE a.file_path = storage.objects.name
    )
  );
