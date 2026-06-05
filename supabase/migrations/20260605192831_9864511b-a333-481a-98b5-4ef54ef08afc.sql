
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1) publications
CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  tagline text,
  brand_voice text,
  display_font text,
  body_font text,
  palette_key text,
  masthead text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read publications" ON public.publications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert publications" ON public.publications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update publications" ON public.publications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete publications" ON public.publications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER touch_publications BEFORE UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) page_status
CREATE TABLE public.page_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  issue_id text NOT NULL,
  page_id text NOT NULL,
  page_label text,
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','writing','editing','review','approved','published','archived')),
  assignee_role text,
  due_date date,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id, page_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_status TO authenticated;
GRANT ALL ON public.page_status TO service_role;
ALTER TABLE public.page_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read page_status" ON public.page_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert page_status" ON public.page_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update page_status" ON public.page_status FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete page_status" ON public.page_status FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER touch_page_status BEFORE UPDATE ON public.page_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX page_status_user_issue_idx ON public.page_status (user_id, issue_id);
CREATE INDEX page_status_user_status_idx ON public.page_status (user_id, status);
CREATE INDEX page_status_user_due_idx ON public.page_status (user_id, due_date);
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_status;
ALTER TABLE public.page_status REPLICA IDENTITY FULL;

-- 3) user_settings
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  active_publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read user_settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert user_settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update user_settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_user_settings BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
