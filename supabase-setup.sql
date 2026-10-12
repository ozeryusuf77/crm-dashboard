-- ============================================================
-- Plak dit in de Supabase SQL Editor en klik op "Run"
-- ============================================================

-- 1. Kennisbank tabel
CREATE TABLE IF NOT EXISTS knowledge_base (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT DEFAULT 'support',
  active      BOOLEAN DEFAULT true,
  embedding   VECTOR(768),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Leads tabel
CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  company     TEXT,
  status      TEXT DEFAULT 'new',
  channel     TEXT DEFAULT 'whatsapp',
  summary     TEXT,
  ai_mode     BOOLEAN DEFAULT true,
  memory      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Gesprekken tabel
CREATE TABLE IF NOT EXISTS conversations (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     TEXT REFERENCES leads(id),
  direction   TEXT NOT NULL,
  text        TEXT NOT NULL,
  ai          BOOLEAN DEFAULT false,
  ts          TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 4. AI query logs tabel
CREATE TABLE IF NOT EXISTS ai_query_logs (
  id            BIGSERIAL PRIMARY KEY,
  question      TEXT NOT NULL,
  matched_items TEXT,
  answer        TEXT,
  escalated     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 5. Indexen voor snelheid
CREATE INDEX IF NOT EXISTS idx_leads_channel  ON leads(channel);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads(status);
CREATE INDEX IF NOT EXISTS idx_convos_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_logs_created   ON ai_query_logs(created_at DESC);

-- 6. RLS (Row Level Security) — aanzetten zodat alleen jij data ziet
ALTER TABLE knowledge_base   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_query_logs     ENABLE ROW LEVEL SECURITY;

-- Tijdelijk: toegang voor alle authenticated users (pas later aan)
CREATE POLICY "Allow all for authenticated" ON knowledge_base   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON leads             FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON conversations     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON ai_query_logs     FOR ALL USING (auth.role() = 'authenticated');

-- 7. Voorbeelddata kennisbank
INSERT INTO knowledge_base (title, content, category, active) VALUES
  ('Pakketprijzen',   'Pakket S: €49/mnd. Pakket M: €99/mnd (tot 15 personen). Pakket L: €199/mnd. Jaarlijks betalen geeft 2 maanden gratis.', 'product',    true),
  ('Levertijden',     'Standaard levering duurt 2-3 werkdagen. Spoed levering is mogelijk voor €15 extra bij bestelling vóór 12:00.',            'product',    true),
  ('Retourbeleid',    '14 dagen retour mogelijk, ongebruikt en in originele verpakking. Restitutie binnen 5 werkdagen.',                         'support',    true),
  ('Escalatieregels', 'Escaleer naar mens bij: maatwerk offerte, klacht, budget >€500, juridische vragen, SAP/enterprise integraties.',          'escalation', true),
  ('Demo aanvragen',  'Demo beschikbaar op werkdagen, duurt 30 minuten. Inplannen via demo@bedrijf.nl of WhatsApp.',                             'sales',      true),
  ('API-integratie',  'REST API beschikbaar. Documentatie op docs.bedrijf.nl. Sandbox omgeving beschikbaar na aanvraag. Node.js, Python, PHP.',  'support',    false)
ON CONFLICT DO NOTHING;
