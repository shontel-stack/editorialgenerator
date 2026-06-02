
CREATE TABLE public.issue_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id TEXT NOT NULL,
  page_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('template','reference')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX issue_attachments_template_unique
  ON public.issue_attachments(issue_id) WHERE kind = 'template';
CREATE UNIQUE INDEX issue_attachments_reference_unique
  ON public.issue_attachments(issue_id, page_id) WHERE kind = 'reference' AND page_id IS NOT NULL;
CREATE INDEX issue_attachments_issue_idx ON public.issue_attachments(issue_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_attachments TO anon, authenticated;
GRANT ALL ON public.issue_attachments TO service_role;

ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read issue attachments" ON public.issue_attachments FOR SELECT USING (true);
CREATE POLICY "anyone can insert issue attachments" ON public.issue_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update issue attachments" ON public.issue_attachments FOR UPDATE USING (true);
CREATE POLICY "anyone can delete issue attachments" ON public.issue_attachments FOR DELETE USING (true);

-- Storage policies for issue-attachments bucket (private bucket; anon allowed to match issue posture)
CREATE POLICY "anyone can read issue attachment files"
  ON storage.objects FOR SELECT USING (bucket_id = 'issue-attachments');
CREATE POLICY "anyone can upload issue attachment files"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'issue-attachments');
CREATE POLICY "anyone can update issue attachment files"
  ON storage.objects FOR UPDATE USING (bucket_id = 'issue-attachments');
CREATE POLICY "anyone can delete issue attachment files"
  ON storage.objects FOR DELETE USING (bucket_id = 'issue-attachments');
