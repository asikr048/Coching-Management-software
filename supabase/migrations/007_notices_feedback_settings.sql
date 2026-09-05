-- Notices: posted by anyone with staff access (manager, owner, etc.)
CREATE TABLE IF NOT EXISTS notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback: submitted by anyone (public)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site settings: key-value store for configurable values
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default contact link
INSERT INTO site_settings (key, value) VALUES
  ('contact_link', 'https://wa.me/8801302201431'),
  ('contact_label', 'WhatsApp Us')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active notices" ON notices FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage notices" ON notices FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid()));
CREATE POLICY "Anyone submit feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff read feedback" ON feedback FOR SELECT USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid()));
CREATE POLICY "Staff update feedback" ON feedback FOR UPDATE USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid()));
CREATE POLICY "Public read settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Staff manage settings" ON site_settings FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid() AND role IN ('owner','super_manager','manager')));
