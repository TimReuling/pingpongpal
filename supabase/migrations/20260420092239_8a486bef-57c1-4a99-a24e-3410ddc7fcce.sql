CREATE OR REPLACE FUNCTION public.recalculate_player_stats(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_played integer := 0; v_won integer := 0; v_lost integer := 0;
  v_scored integer := 0; v_conceded integer := 0;
  v_best_streak integer := 0; v_current_streak integer := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT winner_id,
      CASE WHEN player1_id = p_profile_id THEN player1_score ELSE player2_score END AS my_score,
      CASE WHEN player1_id = p_profile_id THEN player2_score ELSE player1_score END AS opp_score
    FROM public.matches
    WHERE status = 'finished' AND (player1_id = p_profile_id OR player2_id = p_profile_id)
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
    matches_played = v_played, matches_won = v_won, matches_lost = v_lost,
    total_points_scored = v_scored, total_points_conceded = v_conceded,
    current_win_streak = v_current_streak, best_win_streak = v_best_streak,
    updated_at = now()
  WHERE profile_id = p_profile_id;

  IF NOT FOUND THEN
    INSERT INTO public.player_stats (profile_id, matches_played, matches_won, matches_lost,
      total_points_scored, total_points_conceded, current_win_streak, best_win_streak)
    VALUES (p_profile_id, v_played, v_won, v_lost, v_scored, v_conceded, v_current_streak, v_best_streak);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_match_and_recalculate(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p1 uuid; v_p2 uuid;
BEGIN
  SELECT player1_id, player2_id INTO v_p1, v_p2 FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;
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
  DELETE FROM public.matches;
  UPDATE public.player_stats SET
    matches_played = 0, matches_won = 0, matches_lost = 0,
    total_points_scored = 0, total_points_conceded = 0,
    current_win_streak = 0, best_win_streak = 0, updated_at = now();
END; $$;

GRANT EXECUTE ON FUNCTION public.recalculate_player_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match_and_recalculate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_player_matches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_stats() TO authenticated;

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         UUID        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  from_profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at     TIMESTAMPTZ
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their deletion requests"   ON public.deletion_requests;
DROP POLICY IF EXISTS "Users can create deletion requests"       ON public.deletion_requests;
DROP POLICY IF EXISTS "Users can update deletion requests"       ON public.deletion_requests;

CREATE POLICY "Users can view their deletion requests"
ON public.deletion_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = from_profile_id
    AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = to_profile_id
    AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);

CREATE POLICY "Users can create deletion requests"
ON public.deletion_requests FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = from_profile_id
    AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);

CREATE POLICY "Users can update deletion requests"
ON public.deletion_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = from_profile_id
    AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = to_profile_id
    AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid())))
);

CREATE OR REPLACE FUNCTION public.request_match_deletion(
  p_match_id uuid, p_requesting_profile_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p1 uuid; v_p2 uuid; v_other uuid;
  v_from_owner uuid; v_to_owner uuid; v_request_id uuid;
BEGIN
  SELECT player1_id, player2_id INTO v_p1, v_p2
  FROM public.matches WHERE id = p_match_id AND status = 'finished';
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF    p_requesting_profile_id = v_p1 THEN v_other := v_p2;
  ELSIF p_requesting_profile_id = v_p2 THEN v_other := v_p1;
  ELSE RAISE EXCEPTION 'not_a_player';
  END IF;

  SELECT COALESCE(user_id, created_by) INTO v_from_owner FROM public.profiles WHERE id = p_requesting_profile_id;
  SELECT COALESCE(user_id, created_by) INTO v_to_owner   FROM public.profiles WHERE id = v_other;

  IF v_from_owner IS NOT DISTINCT FROM v_to_owner THEN
    DELETE FROM public.matches WHERE id = p_match_id;
    PERFORM public.recalculate_player_stats(v_p1);
    PERFORM public.recalculate_player_stats(v_p2);
    RETURN NULL;
  END IF;

  UPDATE public.deletion_requests
  SET status = 'cancelled', responded_at = now()
  WHERE match_id = p_match_id
    AND from_profile_id = p_requesting_profile_id
    AND status = 'pending';

  INSERT INTO public.deletion_requests (match_id, from_profile_id, to_profile_id)
  VALUES (p_match_id, p_requesting_profile_id, v_other)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.request_match_deletion(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_deletion_request(
  p_request_id uuid, p_accept boolean
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.deletion_requests%ROWTYPE; v_p1 uuid; v_p2 uuid;
BEGIN
  SELECT * INTO v_req FROM public.deletion_requests
  WHERE id = p_request_id AND status = 'pending' FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT p_accept THEN
    UPDATE public.deletion_requests SET status = 'declined', responded_at = now() WHERE id = p_request_id;
    RETURN false;
  END IF;

  UPDATE public.deletion_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;

  SELECT player1_id, player2_id INTO v_p1, v_p2 FROM public.matches WHERE id = v_req.match_id;
  IF FOUND THEN
    DELETE FROM public.matches WHERE id = v_req.match_id;
    PERFORM public.recalculate_player_stats(v_p1);
    PERFORM public.recalculate_player_stats(v_p2);
  END IF;

  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.respond_to_deletion_request(uuid, boolean) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.deletion_requests;