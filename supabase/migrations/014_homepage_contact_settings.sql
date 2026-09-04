-- Insert default contact and homepage settings into site_settings
INSERT INTO site_settings (key, value) VALUES
  ('contact_phone', '01302201431'),
  ('contact_email', 'info@medhashiree.com'),
  ('contact_address', 'Rajshahi, Bangladesh'),
  ('contact_link', 'https://wa.me/8801302201431'),
  ('contact_label', 'WhatsApp Us'),
  ('footer_about', 'Rajshahi''s premier coaching center. Quality education, expert teachers, and a proven track record of student success.')
ON CONFLICT (key) DO NOTHING;
