-- Add youtube_url column to songs table
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS youtube_url TEXT;