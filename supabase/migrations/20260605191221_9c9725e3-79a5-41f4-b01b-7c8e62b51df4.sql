-- Staff threads: one per (user, issue, role)
CREATE TABLE public.staff_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issue_id text NOT NULL,
  role text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_threads TO authenticated;
GRANT ALL ON public.staff_threads TO service_role;

ALTER TABLE public.staff_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their staff threads"
  ON public.staff_threads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their staff threads"
  ON public.staff_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their staff threads"
  ON public.staff_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their staff threads"
  ON public.staff_threads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX staff_threads_user_issue_idx ON public.staff_threads (user_id, issue_id);

-- Messages persisted per thread (AI SDK UIMessage shape stored in parts jsonb)
CREATE TABLE public.staff_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.staff_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL, -- 'user' | 'assistant' | 'system'
  parts jsonb NOT NULL,
  message_id text,    -- AI SDK msg_... id for dedupe
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_messages TO authenticated;
GRANT ALL ON public.staff_messages TO service_role;

ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their staff messages"
  ON public.staff_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their staff messages"
  ON public.staff_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their staff messages"
  ON public.staff_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX staff_messages_thread_idx ON public.staff_messages (thread_id, created_at);

-- Touch updated_at on staff_threads
CREATE OR REPLACE FUNCTION public.touch_staff_thread()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.staff_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_messages_touch_thread
AFTER INSERT ON public.staff_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_staff_thread();