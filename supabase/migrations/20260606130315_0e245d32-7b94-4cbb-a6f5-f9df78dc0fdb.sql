
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS margin_top_in numeric,
  ADD COLUMN IF NOT EXISTS margin_right_in numeric,
  ADD COLUMN IF NOT EXISTS margin_bottom_in numeric,
  ADD COLUMN IF NOT EXISTS margin_left_in numeric,
  ADD COLUMN IF NOT EXISTS bleed_in numeric;
