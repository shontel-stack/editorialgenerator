REVOKE ALL ON public.issue_templates FROM anon;
REVOKE ALL ON public.page_comments FROM anon;
REVOKE ALL ON public.page_comment_replies FROM anon;
REVOKE ALL ON public.generated_assets FROM anon;
REVOKE ALL ON public.issue_versions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_comment_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_assets TO authenticated;
GRANT ALL ON public.issue_templates TO service_role;
GRANT ALL ON public.page_comments TO service_role;
GRANT ALL ON public.page_comment_replies TO service_role;
GRANT ALL ON public.generated_assets TO service_role;
GRANT ALL ON public.issue_versions TO service_role;

DROP POLICY IF EXISTS "Users manage own templates" ON public.issue_templates;
CREATE POLICY "Users manage own templates" ON public.issue_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners manage their comments" ON public.page_comments;
CREATE POLICY "Owners manage their comments" ON public.page_comments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners manage generated assets" ON public.generated_assets;
CREATE POLICY "Owners manage generated assets" ON public.generated_assets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners manage their replies" ON public.page_comment_replies;
CREATE POLICY "Owners manage their replies" ON public.page_comment_replies
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comment owners read replies" ON public.page_comment_replies
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.page_comments c
    WHERE c.id = page_comment_replies.comment_id AND c.user_id = auth.uid()
  ));