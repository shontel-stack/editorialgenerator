CREATE TABLE public.generated_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  creative_type text NOT NULL,
  prompt text NOT NULL,
  refined_prompt text,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  brand_applied boolean NOT NULL DEFAULT false,
  aspect text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_assets TO authenticated;
GRANT ALL ON public.generated_assets TO service_role;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage generated assets" ON public.generated_assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX generated_assets_user_created_idx ON public.generated_assets (user_id, created_at DESC);