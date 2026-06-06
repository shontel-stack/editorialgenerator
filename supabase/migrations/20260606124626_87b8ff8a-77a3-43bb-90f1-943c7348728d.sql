ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS page_width_in numeric(8,4),
  ADD COLUMN IF NOT EXISTS page_height_in numeric(8,4);

ALTER TABLE public.publications
  ADD CONSTRAINT publications_page_dims_positive
  CHECK (
    (page_width_in IS NULL AND page_height_in IS NULL)
    OR (page_width_in > 0 AND page_height_in > 0
        AND page_width_in <= 100 AND page_height_in <= 100)
  );