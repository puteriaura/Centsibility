-- Add session_token to kids table
ALTER TABLE public.kids ADD COLUMN session_token text;

-- Add index to speed up lookups by session token
CREATE INDEX IF NOT EXISTS kids_session_token_idx ON public.kids(session_token);
