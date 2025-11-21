-- Add biography field to artists table
ALTER TABLE public.artists 
ADD COLUMN biography TEXT,
ADD COLUMN biography_source TEXT CHECK (biography_source IN ('wikipedia', 'ai', NULL));