ALTER TABLE public.page_status
  ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'free-form';

ALTER TABLE public.page_status
  DROP CONSTRAINT IF EXISTS page_status_layout_check;

ALTER TABLE public.page_status
  ADD CONSTRAINT page_status_layout_check
  CHECK (layout IN (
    'free-form',
    'single-column',
    'two-column',
    'three-column',
    'image-top',
    'image-left',
    'image-right',
    'full-bleed-image'
  ));