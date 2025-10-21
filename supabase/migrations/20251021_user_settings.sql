-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classification_prompt TEXT NOT NULL DEFAULT 'Du bist Assistenz einer Hausverwaltung. Klassifiziere neue E-Mails als Needs reply / Waiting / FYI. Falls Needs reply, verfasse einen höflichen kurzen Antwortentwurf auf Deutsch im ''Sie''-Ton mit fehlenden Infos und nächsten Schritten.',
  subscription_id TEXT,
  subscription_expiry TIMESTAMPTZ,
  delta_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create row level security policies
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read their own settings
CREATE POLICY "Users can read their own settings" 
  ON public.user_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only update their own settings
CREATE POLICY "Users can update their own settings" 
  ON public.user_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can only insert their own settings
CREATE POLICY "Users can insert their own settings" 
  ON public.user_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
