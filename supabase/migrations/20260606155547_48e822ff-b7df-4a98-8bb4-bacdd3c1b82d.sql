-- Per-page column tuning: column width ratios + gutter override
ALTER TABLE public.page_status
  ADD COLUMN IF NOT EXISTS column_widths jsonb,
  ADD COLUMN IF NOT EXISTS gutter_in numeric;

-- Saved presets for column/gutter tuning, scoped to a layout family
CREATE TABLE IF NOT EXISTS public.layout_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  layout text NOT NULL,
  column_widths jsonb NOT NULL,
  gutter_in numeric NOT NULL DEFAULT 0.167,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layout_presets TO authenticated;
GRANT ALL ON public.layout_presets TO service_role;

ALTER TABLE public.layout_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read layout_presets" ON public.layout_presets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert layout_presets" ON public.layout_presets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update layout_presets" ON public.layout_presets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete layout_presets" ON public.layout_presets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_layout_presets_updated_at
  BEFORE UPDATE ON public.layout_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
