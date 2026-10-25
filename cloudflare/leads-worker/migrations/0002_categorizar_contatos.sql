ALTER TABLE financing_leads
  ADD COLUMN tipo_atendimento TEXT NOT NULL DEFAULT 'financiamento'
  CHECK (tipo_atendimento IN ('compra', 'aluguel', 'financiamento'));

ALTER TABLE financing_leads
  ADD COLUMN origem_cadastro TEXT NOT NULL DEFAULT 'site'
  CHECK (origem_cadastro IN ('site', 'painel'));

CREATE INDEX IF NOT EXISTS idx_financing_leads_category_created
  ON financing_leads (tipo_atendimento, created_at DESC);
