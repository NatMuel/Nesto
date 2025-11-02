-- Create labels table for custom email classification labels
CREATE TABLE IF NOT EXISTS public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  draft_prompt TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'preset2',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create row level security policies
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- Users can only read their own labels
CREATE POLICY "Users can read their own labels" 
  ON public.labels 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only insert their own labels
CREATE POLICY "Users can insert their own labels" 
  ON public.labels 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own labels
CREATE POLICY "Users can update their own labels" 
  ON public.labels 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can only delete their own labels
CREATE POLICY "Users can delete their own labels" 
  ON public.labels 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_labels_updated_at
BEFORE UPDATE ON public.labels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Rename classification_prompt to general_prompt in user_settings
ALTER TABLE public.user_settings 
  RENAME COLUMN classification_prompt TO general_prompt;

-- Update default value for general_prompt
ALTER TABLE public.user_settings 
  ALTER COLUMN general_prompt SET DEFAULT 'Du bist Assistenz einer Hausverwaltung. Analysiere eingehende E-Mails basierend auf den verfügbaren Kategorien und erstelle professionelle Antwortentwürfe auf Deutsch im ''Sie''-Ton.';

