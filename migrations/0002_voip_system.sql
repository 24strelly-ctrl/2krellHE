-- VoIP System Migration
-- Create tables for phone numbers, calls, messages, voicemail, and CPaaS integration

-- Phone numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'twilio', 'telnyx', 'plivo'
  provider_sid TEXT,
  country_code TEXT NOT NULL DEFAULT 'US',
  type TEXT NOT NULL DEFAULT 'local', -- 'local', 'tollfree', 'mobile'
  capabilities JSONB DEFAULT '{"voice": true, "sms": true, "mms": false}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'porting'
  forwarding_number TEXT,
  sip_enabled BOOLEAN DEFAULT false,
  sip_credentials JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  phone_number_id TEXT NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  call_sid TEXT,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL, -- 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer'
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  transcription TEXT,
  cost_cents INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- IVR configurations table
CREATE TABLE IF NOT EXISTS ivr_configs (
  id TEXT PRIMARY KEY,
  phone_number_id TEXT NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  greeting_message TEXT,
  menu_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeout_seconds INTEGER DEFAULT 10,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voicemail messages table
CREATE TABLE IF NOT EXISTS voicemail_messages (
  id TEXT PRIMARY KEY,
  phone_number_id TEXT NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  call_id TEXT REFERENCES call_logs(id) ON DELETE SET NULL,
  from_number TEXT NOT NULL,
  recording_url TEXT NOT NULL,
  transcription TEXT,
  duration_seconds INTEGER,
  listened BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS messages table
CREATE TABLE IF NOT EXISTS sms_messages (
  id TEXT PRIMARY KEY,
  phone_number_id TEXT NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  message_sid TEXT,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'sent', 'delivered', 'failed', 'undelivered'
  status_message TEXT,
  cost_cents INTEGER DEFAULT 0,
  media_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CPaaS provider configurations table
CREATE TABLE IF NOT EXISTS cpaas_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE, -- 'twilio', 'telnyx', 'plivo'
  account_sid TEXT,
  auth_token TEXT,
  api_key TEXT,
  api_secret TEXT,
  enabled BOOLEAN DEFAULT false,
  webhook_base_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call analytics table
CREATE TABLE IF NOT EXISTS call_analytics (
  id TEXT PRIMARY KEY,
  phone_number_id TEXT NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  inbound_calls INTEGER DEFAULT 0,
  outbound_calls INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  unique_callers INTEGER DEFAULT 0,
  avg_call_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number_id, date)
);

-- SIP devices table
CREATE TABLE IF NOT EXISTS sip_devices (
  id TEXT PRIMARY KEY,
  phone_number_id TEXT NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  sip_username TEXT NOT NULL,
  sip_password TEXT,
  sip_server TEXT,
  sip_port INTEGER DEFAULT 5060,
  transport TEXT DEFAULT 'udp', -- 'udp', 'tcp', 'tls'
  enabled BOOLEAN DEFAULT true,
  last_registered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON call_logs(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_phone_number ON sms_messages(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_phone_number ON voicemail_messages(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_messages_listened ON voicemail_messages(listened);
CREATE INDEX IF NOT EXISTS idx_call_analytics_date ON call_analytics(date);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_provider ON phone_numbers(provider);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON phone_numbers(status);