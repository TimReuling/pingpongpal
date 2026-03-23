
-- Add server tracking and match_id linkage
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS server integer NOT NULL DEFAULT 1;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS first_server integer NOT NULL DEFAULT 1;

-- Add match_id to match_requests so accepted challenges link to a match
ALTER TABLE public.match_requests ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id);

-- Enable realtime for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
