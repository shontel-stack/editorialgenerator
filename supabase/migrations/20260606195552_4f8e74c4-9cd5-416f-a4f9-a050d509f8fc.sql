ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS last_positions jsonb NOT NULL DEFAULT '{}'::jsonb;