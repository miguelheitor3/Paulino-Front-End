CREATE TABLE IF NOT EXISTS financing_leads (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 100),
  telefone TEXT NOT NULL CHECK (length(telefone) BETWEEN 10 AND 13),
  email TEXT,
  cidade TEXT NOT NULL CHECK (length(cidade) BETWEEN 2 AND 100),
  tipo_imovel TEXT,
  valor_maximo INTEGER CHECK (valor_maximo IS NULL OR valor_maximo > 0),
  quartos_minimos INTEGER CHECK (quartos_minimos IS NULL OR quartos_minimos BETWEEN 0 AND 20),
  entrada_faixa TEXT CHECK (entrada_faixa IS NULL OR entrada_faixa IN ('ate_20_mil', '20_a_50_mil', '50_a_100_mil', 'acima_100_mil')),
  pretende_usar_fgts INTEGER CHECK (pretende_usar_fgts IS NULL OR pretende_usar_fgts IN (0, 1)),
  consentiu_contato INTEGER NOT NULL DEFAULT 1 CHECK (consentiu_contato = 1),
  versao_aviso_privacidade TEXT NOT NULL DEFAULT '2026-10-v1',
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_contato', 'simulacao', 'convertido', 'encerrado')),
  observacoes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_financing_leads_created_at
  ON financing_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financing_leads_status
  ON financing_leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financing_leads_phone
  ON financing_leads (telefone);

CREATE TABLE IF NOT EXISTS lead_submission_limits (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_lead_submission_limits_expiry
  ON lead_submission_limits (expires_at);
