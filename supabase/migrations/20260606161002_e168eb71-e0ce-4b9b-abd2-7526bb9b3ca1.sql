-- Allow multiple references per page
DROP INDEX IF EXISTS public.issue_attachments_reference_unique;

-- Add assignment columns
ALTER TABLE public.issue_attachments
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS position_x numeric,
  ADD COLUMN IF NOT EXISTS position_y numeric;

-- Sanity bounds for normalized coordinates
ALTER TABLE public.issue_attachments
  DROP CONSTRAINT IF EXISTS issue_attachments_position_x_bounds;
ALTER TABLE public.issue_attachments
  ADD CONSTRAINT issue_attachments_position_x_bounds
  CHECK (position_x IS NULL OR (position_x >= 0 AND position_x <= 1));

ALTER TABLE public.issue_attachments
  DROP CONSTRAINT IF EXISTS issue_attachments_position_y_bounds;
ALTER TABLE public.issue_attachments
  ADD CONSTRAINT issue_attachments_position_y_bounds
  CHECK (position_y IS NULL OR (position_y >= 0 AND position_y <= 1));

-- Helpful index for per-page lookups
CREATE INDEX IF NOT EXISTS issue_attachments_page_idx
  ON public.issue_attachments (issue_id, page_id)
  WHERE page_id IS NOT NULL;