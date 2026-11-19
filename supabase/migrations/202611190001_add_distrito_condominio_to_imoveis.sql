ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS distrito text,
  ADD COLUMN IF NOT EXISTS condominio text;
