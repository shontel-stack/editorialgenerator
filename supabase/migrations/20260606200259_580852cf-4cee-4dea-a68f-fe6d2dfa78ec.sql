
CREATE TABLE public.issue_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  publication_id UUID,
  issue_id TEXT NOT NULL,
  issue_label TEXT,
  data JSONB NOT NULL,
  client_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_drafts TO authenticated;
GRANT ALL ON public.issue_drafts TO service_role;

ALTER TABLE public.issue_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read issue_drafts" ON public.issue_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert issue_drafts" ON public.issue_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update issue_drafts" ON public.issue_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete issue_drafts" ON public.issue_drafts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_issue_drafts_updated_at
  BEFORE UPDATE ON public.issue_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX issue_drafts_user_updated_idx
  ON public.issue_drafts (user_id, client_updated_at DESC);
