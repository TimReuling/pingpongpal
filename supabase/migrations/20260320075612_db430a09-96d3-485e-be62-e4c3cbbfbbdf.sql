
-- Create match_requests table for match approval flow
CREATE TABLE public.match_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_score integer NOT NULL DEFAULT 11,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their match requests" ON public.match_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = match_requests.from_profile_id AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
    OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = match_requests.to_profile_id AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
  );

CREATE POLICY "Users can create match requests" ON public.match_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = match_requests.from_profile_id AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
  );

CREATE POLICY "Recipients can update match requests" ON public.match_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = match_requests.to_profile_id AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
    OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = match_requests.from_profile_id AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
  );

CREATE POLICY "Users can delete their match requests" ON public.match_requests
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = match_requests.from_profile_id AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
  );

-- Enable realtime for match requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_requests;

-- Create storage bucket for avatar uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update their avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
