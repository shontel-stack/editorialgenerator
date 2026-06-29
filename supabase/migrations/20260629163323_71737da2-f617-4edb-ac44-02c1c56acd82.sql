CREATE TABLE public.issue_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  publication_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_templates TO authenticated;
GRANT ALL ON public.issue_templates TO service_role;
ALTER TABLE public.issue_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates" ON public.issue_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX issue_templates_user_idx ON public.issue_templates(user_id, created_at DESC);
CREATE TRIGGER issue_templates_touch BEFORE UPDATE ON public.issue_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();