
-- Function to recalculate player stats from finished matches
CREATE OR REPLACE FUNCTION public.recalculate_player_stats(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_played integer := 0;
  v_won integer := 0;
  v_lost integer := 0;
  v_scored integer := 0;
  v_conceded integer := 0;
  v_best_streak integer := 0;
  v_current_streak integer := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT winner_id,
      CASE WHEN player1_id = p_profile_id THEN player1_score ELSE player2_score END AS my_score,
      CASE WHEN player1_id = p_profile_id THEN player2_score ELSE player1_score END AS opp_score
    FROM public.matches
    WHERE status = 'finished'
      AND (player1_id = p_profile_id OR player2_id = p_profile_id)
    ORDER BY completed_at ASC NULLS LAST, created_at ASC
  LOOP
    v_played := v_played + 1;
    v_scored := v_scored + v_rec.my_score;
    v_conceded := v_conceded + v_rec.opp_score;
    IF v_rec.winner_id = p_profile_id THEN
      v_won := v_won + 1;
      v_current_streak := v_current_streak + 1;
      IF v_current_streak > v_best_streak THEN v_best_streak := v_current_streak; END IF;
    ELSE
      v_lost := v_lost + 1;
      v_current_streak := 0;
    END IF;
  END LOOP;

  UPDATE public.player_stats SET
    matches_played = v_played,
    matches_won = v_won,
    matches_lost = v_lost,
    total_points_scored = v_scored,
    total_points_conceded = v_conceded,
    current_win_streak = v_current_streak,
    best_win_streak = v_best_streak,
    updated_at = now()
  WHERE profile_id = p_profile_id;

  IF NOT FOUND THEN
    INSERT INTO public.player_stats (profile_id, matches_played, matches_won, matches_lost,
      total_points_scored, total_points_conceded, current_win_streak, best_win_streak)
    VALUES (p_profile_id, v_played, v_won, v_lost, v_scored, v_conceded, v_current_streak, v_best_streak);
  END IF;
END; $$;

-- Delete a single match and recalculate stats for both players
CREATE OR REPLACE FUNCTION public.delete_match_and_recalculate(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p1 uuid;
  v_p2 uuid;
BEGIN
  SELECT player1_id, player2_id INTO v_p1, v_p2
  FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM public.matches WHERE id = p_match_id;

  PERFORM public.recalculate_player_stats(v_p1);
  PERFORM public.recalculate_player_stats(v_p2);
END; $$;

-- Delete all matches for a specific player and recalculate
CREATE OR REPLACE FUNCTION public.delete_player_matches(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_affected_profiles uuid[];
BEGIN
  SELECT array_agg(DISTINCT other_id) INTO v_affected_profiles FROM (
    SELECT CASE WHEN player1_id = p_profile_id THEN player2_id ELSE player1_id END AS other_id
    FROM public.matches
    WHERE status = 'finished' AND (player1_id = p_profile_id OR player2_id = p_profile_id)
  ) sub;

  DELETE FROM public.matches
  WHERE player1_id = p_profile_id OR player2_id = p_profile_id;

  PERFORM public.recalculate_player_stats(p_profile_id);

  IF v_affected_profiles IS NOT NULL THEN
    FOR i IN 1..array_length(v_affected_profiles, 1) LOOP
      PERFORM public.recalculate_player_stats(v_affected_profiles[i]);
    END LOOP;
  END IF;
END; $$;

-- Reset all stats and matches globally
CREATE OR REPLACE FUNCTION public.reset_all_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.matches;
  UPDATE public.player_stats SET
    matches_played = 0, matches_won = 0, matches_lost = 0,
    total_points_scored = 0, total_points_conceded = 0,
    current_win_streak = 0, best_win_streak = 0, updated_at = now();
END; $$;

-- Allow authenticated users to DELETE matches (needed for the delete functions)
CREATE POLICY "Users can delete their matches"
ON public.matches FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = matches.player1_id
    AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = matches.player2_id
    AND (profiles.user_id = auth.uid() OR (profiles.is_guest = true AND profiles.created_by = auth.uid())))
);

GRANT EXECUTE ON FUNCTION public.recalculate_player_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match_and_recalculate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_player_matches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_stats() TO authenticated;
