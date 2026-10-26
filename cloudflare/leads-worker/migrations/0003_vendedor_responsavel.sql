ALTER TABLE financing_leads
  ADD COLUMN vendedor_responsavel TEXT
  CHECK (vendedor_responsavel IS NULL OR vendedor_responsavel IN ('Thomas', 'Antonio', 'Sandra'));

CREATE INDEX IF NOT EXISTS idx_financing_leads_vendedor_created
  ON financing_leads (vendedor_responsavel, created_at DESC);
