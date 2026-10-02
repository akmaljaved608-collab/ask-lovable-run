CREATE TABLE public.countdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  target_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.countdowns TO authenticated;
GRANT ALL ON public.countdowns TO service_role;
ALTER TABLE public.countdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own countdowns" ON public.countdowns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_countdowns_updated_at BEFORE UPDATE ON public.countdowns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();