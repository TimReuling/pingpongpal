-- match_requests.match_id references matches(id) without ON DELETE CASCADE.
-- Deleting a match fails when match_requests rows still reference it.
-- Fix: drop and re-add the FK with CASCADE, and update all delete RPCs
-- to explicitly clean match_requests as a belt-and-suspenders guard.

ALTER TABLE public.match_requests
  DROP CONSTRAINT IF EXISTS match_requests_match_id_fkey;

ALTER TABLE public.match_requests
  ADD CONSTRAINT match_requests_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

-- Re-create delete_match_and_recalculate to clean match_requests first
CREATE OR REPLACE FUNCTION public.delete_match_and_recalculate(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p1 uuid; v_p2 uuid;
BEGIN
  SELECT player1_id, player2_id INTO v_p1, v_p2 FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM public.match_requests WHERE match_id = p_match_id;
  DELETE FROM public.matches WHERE id = p_match_id;
  PERFORM public.recalculate_player_stats(v_p1);
  PERFORM public.recalculate_player_stats(v_p2);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_player_matches(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_affected_profiles uuid[];
BEGIN
  SELECT array_agg(DISTINCT other_id) INTO v_affected_profiles FROM (
    SELECT CASE WHEN player1_id = p_profile_id THEN player2_id ELSE player1_id END AS other_id
    FROM public.matches WHERE status = 'finished'
      AND (player1_id = p_profile_id OR player2_id = p_profile_id)
  ) sub;
  DELETE FROM public.match_requests
    WHERE match_id IN (
      SELECT id FROM public.matches
      WHERE player1_id = p_profile_id OR player2_id = p_profile_id
    );
  DELETE FROM public.matches WHERE player1_id = p_profile_id OR player2_id = p_profile_id;
  PERFORM public.recalculate_player_stats(p_profile_id);
  IF v_affected_profiles IS NOT NULL THEN
    FOR i IN 1..array_length(v_affected_profiles, 1) LOOP
      PERFORM public.recalculate_player_stats(v_affected_profiles[i]);
    END LOOP;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.reset_all_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.match_requests;
  DELETE FROM public.matches;
  UPDATE public.player_stats SET
    matches_played = 0, matches_won = 0, matches_lost = 0,
    total_points_scored = 0, total_points_conceded = 0,
    current_win_streak = 0, best_win_streak = 0, updated_at = now();
END; $$;

GRANT EXECUTE ON FUNCTION public.delete_match_and_recalculate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_player_matches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_stats() TO authenticated;
