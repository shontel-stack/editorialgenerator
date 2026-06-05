
-- Add publication scoping
ALTER TABLE public.staff_threads ADD COLUMN IF NOT EXISTS publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL;
ALTER TABLE public.staff_notes ADD COLUMN IF NOT EXISTS publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL;
ALTER TABLE public.issue_attachments ADD COLUMN IF NOT EXISTS publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL;

-- Backfill from each user's currently active publication, where one exists.
UPDATE public.staff_threads st
  SET publication_id = us.active_publication_id
  FROM public.user_settings us
  WHERE st.user_id = us.user_id
    AND st.publication_id IS NULL
    AND us.active_publication_id IS NOT NULL;

UPDATE public.staff_notes sn
  SET publication_id = us.active_publication_id
  FROM public.user_settings us
  WHERE sn.user_id = us.user_id
    AND sn.publication_id IS NULL
    AND us.active_publication_id IS NOT NULL;

UPDATE public.issue_attachments ia
  SET publication_id = us.active_publication_id
  FROM public.user_settings us
  WHERE ia.user_id = us.user_id
    AND ia.publication_id IS NULL
    AND us.active_publication_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staff_threads_pub_idx ON public.staff_threads(user_id, publication_id, issue_id);
CREATE INDEX IF NOT EXISTS staff_notes_pub_idx ON public.staff_notes(user_id, publication_id, issue_id);
CREATE INDEX IF NOT EXISTS issue_attachments_pub_idx ON public.issue_attachments(user_id, publication_id, issue_id);
