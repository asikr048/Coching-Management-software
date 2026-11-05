-- =========================================================================
-- Migration 040: Seed BDWebs SMS Gateway (bulksms.bdwebs.com) Configuration
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Public read settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage settings" ON public.site_settings;
CREATE POLICY "Staff manage settings" ON public.site_settings FOR ALL USING (true);

-- Insert or update BDWebs SMS Gateway configuration
INSERT INTO public.site_settings (key, value)
VALUES (
  'sms_gateway_config',
  '{"apiKey":"decentraforce:asikr048@gmail","username":"decentraforce","password":"asikr048@gmail","callType":"GET","baseUrl":"https://smsapi.cloudex.top/api/v1/campaigns/sendsms/plain","urlTemplate":"https://smsapi.cloudex.top/api/v1/campaigns/sendsms/plain?username=decentraforce&password=asikr048@gmail&sender={sender_id}&text={msg}&to={to}","senderId":"","params":[{"id":"p1","key":"username","value":"decentraforce","description":"BDWebs Username","isStandard":true},{"id":"p2","key":"password","value":"asikr048@gmail","description":"BDWebs Password","isStandard":true},{"id":"p3","key":"sender","value":"{sender_id}","description":"Approved Sender ID (Masking/Non-Masking)","isStandard":true},{"id":"p4","key":"text","value":"{msg}","description":"SMS text message","isStandard":true},{"id":"p5","key":"to","value":"{to}","description":"Recipient mobile number","isStandard":true}]}'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
