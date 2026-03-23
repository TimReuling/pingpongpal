ALTER TABLE public.matches
DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches
ADD CONSTRAINT matches_status_check
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'accepted'::text,
  'active'::text,
  'finished'::text,
  'declined'::text,
  'cancelled'::text,
  'abandoned'::text,
  'in_progress'::text,
  'completed'::text
]));

ALTER TABLE public.match_requests
DROP CONSTRAINT IF EXISTS match_requests_status_check;

ALTER TABLE public.match_requests
ADD CONSTRAINT match_requests_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text]));