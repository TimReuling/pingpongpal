
-- Drop overly permissive policies
DROP POLICY "Users can create matches" ON public.matches;
DROP POLICY "Users can update matches" ON public.matches;
DROP POLICY "Users can insert stats" ON public.player_stats;
DROP POLICY "Users can update stats" ON public.player_stats;

-- Matches: users can create/update matches they're involved in
CREATE POLICY "Users can create matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = player1_id AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = player2_id AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);
CREATE POLICY "Users can update matches" ON public.matches FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = player1_id AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = player2_id AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);

-- Stats: users can manage stats for their own profiles or guests they created
CREATE POLICY "Users can insert stats" ON public.player_stats FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = profile_id AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);
CREATE POLICY "Users can update stats" ON public.player_stats FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = profile_id AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);
