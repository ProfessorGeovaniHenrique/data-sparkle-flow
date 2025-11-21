-- Update biography_source constraint to include 'web' option
ALTER TABLE public.artists 
DROP CONSTRAINT IF EXISTS artists_biography_source_check;

ALTER TABLE public.artists 
ADD CONSTRAINT artists_biography_source_check 
CHECK (biography_source IN ('wikipedia', 'web', 'ai', NULL));