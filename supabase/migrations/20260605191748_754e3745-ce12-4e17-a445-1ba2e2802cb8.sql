CREATE TABLE public.staff_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  issue_id text NOT NULL,
  page_id text,
  thread_id uuid,
  role text NOT NULL,
  type text NOT NULL CHECK (type IN ('comment','edit_suggestion','status_change','flag')),
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_notes TO authenticated;
GRANT ALL ON public.staff_notes TO service_role;

ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their staff notes" ON public.staff_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners can insert their staff notes" ON public.staff_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their staff notes" ON public.staff_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete their staff notes" ON public.staff_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX staff_notes_issue_idx ON public.staff_notes (user_id, issue_id, status, created_at DESC);
CREATE INDEX staff_notes_page_idx ON public.staff_notes (user_id, issue_id, page_id);

CREATE OR REPLACE FUNCTION public.touch_staff_note()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('resolved','dismissed') AND OLD.status = 'open' THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_notes_touch BEFORE UPDATE ON public.staff_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_staff_note();