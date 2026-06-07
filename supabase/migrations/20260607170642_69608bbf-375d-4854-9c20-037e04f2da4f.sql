
-- Brand-kit assets: custom fonts and color swatches per publication
CREATE TABLE public.brand_fonts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  publication_id UUID NOT NULL,
  family_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 400,
  style TEXT NOT NULL DEFAULT 'normal',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_fonts TO authenticated;
GRANT ALL ON public.brand_fonts TO service_role;
ALTER TABLE public.brand_fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read brand_fonts" ON public.brand_fonts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert brand_fonts" ON public.brand_fonts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update brand_fonts" ON public.brand_fonts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete brand_fonts" ON public.brand_fonts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_brand_fonts_updated_at BEFORE UPDATE ON public.brand_fonts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_brand_fonts_publication ON public.brand_fonts(publication_id);

CREATE TABLE public.brand_swatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  publication_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  hex TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_swatches TO authenticated;
GRANT ALL ON public.brand_swatches TO service_role;
ALTER TABLE public.brand_swatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read brand_swatches" ON public.brand_swatches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert brand_swatches" ON public.brand_swatches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update brand_swatches" ON public.brand_swatches FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete brand_swatches" ON public.brand_swatches FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_brand_swatches_updated_at BEFORE UPDATE ON public.brand_swatches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_brand_swatches_publication ON public.brand_swatches(publication_id);

-- Publication-level slot overrides referencing a custom brand font
ALTER TABLE public.publications
  ADD COLUMN display_font_custom_id UUID REFERENCES public.brand_fonts(id) ON DELETE SET NULL,
  ADD COLUMN serif_font_custom_id   UUID REFERENCES public.brand_fonts(id) ON DELETE SET NULL,
  ADD COLUMN sans_font_custom_id    UUID REFERENCES public.brand_fonts(id) ON DELETE SET NULL;
