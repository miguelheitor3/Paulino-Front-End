ALTER TABLE financing_leads
  ADD COLUMN consentiu_ofertas_whatsapp INTEGER NOT NULL DEFAULT 0
  CHECK (consentiu_ofertas_whatsapp IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_financing_leads_whatsapp_offers
  ON financing_leads (consentiu_ofertas_whatsapp, tipo_atendimento, created_at DESC);
