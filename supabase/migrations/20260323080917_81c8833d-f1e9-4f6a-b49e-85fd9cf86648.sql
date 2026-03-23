-- Add session lifecycle tracking for shared matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Keep updated_at fresh for lifecycle validation and stale-session cleanup
DROP TRIGGER IF EXISTS update_matches_updated_at ON public.matches;
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent duplicate active sessions for the same player pair
CREATE UNIQUE INDEX IF NOT EXISTS matches_unique_active_pair_idx
ON public.matches (
  LEAST(player1_id::text, player2_id::text),
  GREATEST(player1_id::text, player2_id::text)
)
WHERE status = 'active';

-- Fast lookup for resume / cleanup flows
CREATE INDEX IF NOT EXISTS matches_status_updated_at_idx
ON public.matches (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS matches_player1_status_idx
ON public.matches (player1_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS matches_player2_status_idx
ON public.matches (player2_id, status, updated_at DESC);

-- Atomically accept a request and create/reuse one shared active session
CREATE OR REPLACE FUNCTION public.accept_match_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.match_requests%ROWTYPE;
  v_match_id uuid;
BEGIN
  SELECT *
  INTO v_request
  FROM public.match_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_request.status = 'accepted' AND v_request.match_id IS NOT NULL THEN
    RETURN v_request.match_id;
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  UPDATE public.matches
  SET
    status = 'abandoned',
    completed_at = COALESCE(completed_at, now())
  WHERE status IN ('active', 'accepted', 'in_progress')
    AND updated_at < now() - interval '12 hours'
    AND (
      player1_id IN (v_request.from_profile_id, v_request.to_profile_id)
      OR player2_id IN (v_request.from_profile_id, v_request.to_profile_id)
    );

  SELECT id
  INTO v_match_id
  FROM public.matches
  WHERE status = 'active'
    AND (
      (player1_id = v_request.from_profile_id AND player2_id = v_request.to_profile_id)
      OR (player1_id = v_request.to_profile_id AND player2_id = v_request.from_profile_id)
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_match_id IS NULL THEN
    INSERT INTO public.matches (player1_id, player2_id, target_score, status)
    VALUES (v_request.from_profile_id, v_request.to_profile_id, v_request.target_score, 'active')
    RETURNING id INTO v_match_id;
  END IF;

  UPDATE public.match_requests
  SET
    status = 'accepted',
    responded_at = now(),
    match_id = v_match_id
  WHERE id = p_request_id;

  RETURN v_match_id;
END;
$$;

-- Atomically close a shared session exactly once and persist final stats safely
CREATE OR REPLACE FUNCTION public.finalize_match_session(
  p_match_id uuid,
  p_status text DEFAULT 'finished',
  p_closed_by_profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  winner_id uuid,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_winner_id uuid;
  v_loser_id uuid;
  v_winner_scored integer;
  v_loser_scored integer;
BEGIN
  SELECT *
  INTO v_match
  FROM public.matches
  WHERE public.matches.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_match.status NOT IN ('active', 'accepted', 'in_progress') THEN
    id := v_match.id;
    status := v_match.status;
    winner_id := v_match.winner_id;
    completed_at := v_match.completed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status NOT IN ('finished', 'cancelled', 'abandoned') THEN
    RAISE EXCEPTION 'Invalid match status: %', p_status;
  END IF;

  IF p_status = 'finished' THEN
    v_winner_id := v_match.winner_id;

    IF v_winner_id IS NULL THEN
      IF v_match.player1_score > v_match.player2_score THEN
        v_winner_id := v_match.player1_id;
      ELSIF v_match.player2_score > v_match.player1_score THEN
        v_winner_id := v_match.player2_id;
      ELSE
        RAISE EXCEPTION 'Finished matches require a winner';
      END IF;
    END IF;

    v_loser_id := CASE WHEN v_winner_id = v_match.player1_id THEN v_match.player2_id ELSE v_match.player1_id END;
    v_winner_scored := CASE WHEN v_winner_id = v_match.player1_id THEN v_match.player1_score ELSE v_match.player2_score END;
    v_loser_scored := CASE WHEN v_winner_id = v_match.player1_id THEN v_match.player2_score ELSE v_match.player1_score END;

    UPDATE public.player_stats
    SET
      matches_played = matches_played + 1,
      matches_won = matches_won + 1,
      total_points_scored = total_points_scored + v_winner_scored,
      total_points_conceded = total_points_conceded + v_loser_scored,
      current_win_streak = current_win_streak + 1,
      best_win_streak = GREATEST(best_win_streak, current_win_streak + 1),
      updated_at = now()
    WHERE profile_id = v_winner_id;

    UPDATE public.player_stats
    SET
      matches_played = matches_played + 1,
      matches_lost = matches_lost + 1,
      total_points_scored = total_points_scored + v_loser_scored,
      total_points_conceded = total_points_conceded + v_winner_scored,
      current_win_streak = 0,
      updated_at = now()
    WHERE profile_id = v_loser_id;
  ELSE
    v_winner_id := NULL;
  END IF;

  UPDATE public.matches
  SET
    status = p_status,
    winner_id = CASE WHEN p_status = 'finished' THEN COALESCE(v_match.winner_id, v_winner_id) ELSE NULL END,
    completed_at = COALESCE(completed_at, now()),
    updated_at = now()
  WHERE public.matches.id = p_match_id
  RETURNING public.matches.id, public.matches.status, public.matches.winner_id, public.matches.completed_at
  INTO id, status, winner_id, completed_at;

  RETURN NEXT;
END;
$$;

-- Cleanup helper for stale orphaned sessions so they stop blocking new games
CREATE OR REPLACE FUNCTION public.cleanup_stale_match_sessions(p_profile_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH stale AS (
    UPDATE public.matches
    SET
      status = 'abandoned',
      completed_at = COALESCE(completed_at, now()),
      updated_at = now()
    WHERE status IN ('active', 'accepted', 'in_progress')
      AND updated_at < now() - interval '12 hours'
      AND (
        p_profile_id IS NULL
        OR player1_id = p_profile_id
        OR player2_id = p_profile_id
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM stale;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_match_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_match_session(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_match_sessions(uuid) TO authenticated;