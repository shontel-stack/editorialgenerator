
DELETE FROM public.issue_attachments;
DELETE FROM public.issue_chats;

ALTER TABLE public.issue_attachments
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.issue_chats
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX issue_attachments_user_id_idx ON public.issue_attachments(user_id);
CREATE INDEX issue_chats_user_id_idx ON public.issue_chats(user_id);

DROP POLICY IF EXISTS "read attachments by issue_id" ON public.issue_attachments;
DROP POLICY IF EXISTS "insert attachments with issue_id" ON public.issue_attachments;
DROP POLICY IF EXISTS "update attachments by issue_id" ON public.issue_attachments;
DROP POLICY IF EXISTS "delete attachments by issue_id" ON public.issue_attachments;

CREATE POLICY "Owners can read their attachments"
  ON public.issue_attachments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owners can insert their attachments"
  ON public.issue_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their attachments"
  ON public.issue_attachments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete their attachments"
  ON public.issue_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anyone can read issue chats" ON public.issue_chats;
DROP POLICY IF EXISTS "anyone can insert issue chats" ON public.issue_chats;
DROP POLICY IF EXISTS "anyone can delete issue chats" ON public.issue_chats;

CREATE POLICY "Owners can read their chats"
  ON public.issue_chats FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owners can insert their chats"
  ON public.issue_chats FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete their chats"
  ON public.issue_chats FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anyone can read issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "anyone can upload issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "anyone can update issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "anyone can delete issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "read issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "upload issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "update issue attachment files" ON storage.objects;
DROP POLICY IF EXISTS "delete issue attachment files" ON storage.objects;

CREATE POLICY "Read own attachment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Upload own attachment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Update own attachment files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Delete own attachment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
