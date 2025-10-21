-- Add Microsoft token columns to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_token_expiry TIMESTAMPTZ;

