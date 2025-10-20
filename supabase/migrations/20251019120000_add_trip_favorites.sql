-- Add favorite and naming support to user_trips
-- Safely add columns if they do not already exist

DO $$
BEGIN
  -- is_favorite boolean
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_trips' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE public.user_trips
      ADD COLUMN is_favorite boolean DEFAULT false;
  END IF;

  -- trip_name text
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_trips' AND column_name = 'trip_name'
  ) THEN
    ALTER TABLE public.user_trips
      ADD COLUMN trip_name text;
  END IF;

  -- notes text
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_trips' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.user_trips
      ADD COLUMN notes text;
  END IF;
END $$;


