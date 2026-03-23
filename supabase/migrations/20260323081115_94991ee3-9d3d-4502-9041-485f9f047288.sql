CREATE OR REPLACE FUNCTION public.update_match_score(
  p_match_id uuid,
  p_player integer,
  p_delta integer
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_new_p1 integer;
  v_new_p2 integer;
  v_total_points integer;
  v_is_deuce boolean;
  v_deuce_points integer;
  v_service_block integer;
  v_server integer;
  v_winner_id uuid;
BEGIN
  IF p_player NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Invalid player index: %', p_player;
  END IF;

  IF p_delta NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'Invalid score delta: %', p_delta;
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_match.status <> 'active' THEN
    RETURN v_match;
  END IF;

  v_new_p1 := CASE WHEN p_player = 1 THEN GREATEST(0, v_match.player1_score + p_delta) ELSE v_match.player1_score END;
  v_new_p2 := CASE WHEN p_player = 2 THEN GREATEST(0, v_match.player2_score + p_delta) ELSE v_match.player2_score END;

  v_total_points := v_new_p1 + v_new_p2;
  v_is_deuce := v_new_p1 >= v_match.target_score - 1 AND v_new_p2 >= v_match.target_score - 1;

  IF v_is_deuce THEN
    v_deuce_points := v_total_points - ((v_match.target_score - 1) * 2);
    v_server := CASE WHEN mod(v_deuce_points, 2) = 0 THEN v_match.first_server ELSE CASE WHEN v_match.first_server = 1 THEN 2 ELSE 1 END END;
  ELSE
    v_service_block := floor(v_total_points / 2.0);
    v_server := CASE WHEN mod(v_service_block, 2) = 0 THEN v_match.first_server ELSE CASE WHEN v_match.first_server = 1 THEN 2 ELSE 1 END END;
  END IF;

  IF v_new_p1 >= v_match.target_score AND v_new_p1 - v_new_p2 >= 2 THEN
    v_winner_id := v_match.player1_id;
  ELSIF v_new_p2 >= v_match.target_score AND v_new_p2 - v_new_p1 >= 2 THEN
    v_winner_id := v_match.player2_id;
  ELSE
    v_winner_id := NULL;
  END IF;

  UPDATE public.matches
  SET
    player1_score = v_new_p1,
    player2_score = v_new_p2,
    server = v_server,
    winner_id = v_winner_id,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  IF v_winner_id IS NOT NULL THEN
    PERFORM public.finalize_match_session(p_match_id, 'finished', NULL);

    SELECT *
    INTO v_match
    FROM public.matches
    WHERE id = p_match_id;
  END IF;

  RETURN v_match;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_match_score(uuid, integer, integer) TO authenticated;