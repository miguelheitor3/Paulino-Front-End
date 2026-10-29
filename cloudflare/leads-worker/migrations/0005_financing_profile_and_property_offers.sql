ALTER TABLE financing_leads ADD COLUMN cpf TEXT;
ALTER TABLE financing_leads ADD COLUMN tem_imovel_nome INTEGER CHECK (tem_imovel_nome IS NULL OR tem_imovel_nome IN (0, 1));
ALTER TABLE financing_leads ADD COLUMN mora_trabalha_tres_pontas INTEGER CHECK (mora_trabalha_tres_pontas IS NULL OR mora_trabalha_tres_pontas IN (0, 1));
ALTER TABLE financing_leads ADD COLUMN possui_fgts INTEGER CHECK (possui_fgts IS NULL OR possui_fgts IN (0, 1));
ALTER TABLE financing_leads ADD COLUMN fgts_mais_35_contribuicoes INTEGER CHECK (fgts_mais_35_contribuicoes IS NULL OR fgts_mais_35_contribuicoes IN (0, 1));

CREATE TABLE IF NOT EXISTS lead_property_offers (
  lead_id TEXT NOT NULL REFERENCES financing_leads(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (lead_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_property_offers_property
  ON lead_property_offers (property_id);
