-- User profiles with auto-generated ID for login
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  auth_user_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create a sequence for auto-incrementing user IDs
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 10001;
