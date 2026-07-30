DROP POLICY IF EXISTS "Owners manage their versions" ON public.issue_versions;
CREATE POLICY "Owners read their versions" ON public.issue_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert their versions" ON public.issue_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update their versions" ON public.issue_versions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete their versions" ON public.issue_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.issue_versions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_versions TO authenticated;
GRANT ALL ON public.issue_versions TO service_role;