-- page_comments
CREATE TABLE public.page_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issue_id text NOT NULL,
  page_id text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  body text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_comments TO authenticated;
GRANT ALL ON public.page_comments TO service_role;
ALTER TABLE public.page_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their comments" ON public.page_comments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER page_comments_touch BEFORE UPDATE ON public.page_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX page_comments_issue_page_idx ON public.page_comments(user_id, issue_id, page_id);

-- page_comment_replies
CREATE TABLE public.page_comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.page_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_comment_replies TO authenticated;
GRANT ALL ON public.page_comment_replies TO service_role;
ALTER TABLE public.page_comment_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their replies" ON public.page_comment_replies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX page_comment_replies_comment_idx ON public.page_comment_replies(comment_id);

-- issue_versions
CREATE TABLE public.issue_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issue_id text NOT NULL,
  label text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_versions TO authenticated;
GRANT ALL ON public.issue_versions TO service_role;
ALTER TABLE public.issue_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their versions" ON public.issue_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX issue_versions_issue_idx ON public.issue_versions(user_id, issue_id, created_at DESC);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_comment_replies;