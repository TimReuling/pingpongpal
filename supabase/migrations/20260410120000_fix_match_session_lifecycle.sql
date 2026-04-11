-- =============================================================
-- Migration: Fix match session lifecycle bugs
-- =============================================================
-- Problems fixed:
--   1. update_match_score used two sequential UPDATEs when a winner
--      was detected, leaving an intermediate row with status='active'
--      but winner_id already set. This caused Realtime race conditions
--      and could leave matches permanently stuck in 'active' state.
--   2. accept_match_request searched for and REUSED an existing active
--      session between the same two players instead of always creating
--      a fresh one. Re-challenges therefore reopened stale sessions.
--   3. Direct match creation (handleSelectOpponent / handleRematch)
--      issued a bare INSERT that fails silently when a stale active
--      session already exists (unique-constraint violation).
--   4. Existing stuck sessions in the database (active + winner set,
--      or active + scores already at winning threshold) are cleaned up.
-- =============================================================

-- =============================================================
-- FIX 1: update_match_score — single atomic UPDATE on win
--
-- Previously: two UPDATEs per transaction
--   a) score + winner_id  (status still 'active')  ← intermediate
--   b) finalize_match_session → status = 'finished'
-- Now: winner path collapses both into one UPDATE, so the row
-- goes directly from {active, no winner} to {finished, winner set}.
-- Stats are also written inline, removing the PERFORM call.
-- =============================================================

CREATE OR REPLACE FUNCTION public.update_match_score(
  p_match_id uuid,
  p_player   integer,
  p_delta    integer
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match         public.matches%ROWTYPE;
  v_new_p1        integer;
  v_new_p2        integer;
  v_total_points  integer;
  v_is_deuce      boolean;
  v_deuce_points  integer;
  v_service_block integer;
  v_server        integer;
  v_winner_id     uuid;
  v_loser_id      uuid;
  v_winner_scored integer;
  v_loser_scored  integer;
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

  -- Only allow scoring on a live active match
  IF v_match.status <> 'active' THEN
    RETURN v_match;
  END IF;

  v_new_p1 := CASE WHEN p_player = 1
    THEN GREATEST(0, v_match.player1_score + p_delta)
    ELSE v_match.player1_score
  END;
  v_new_p2 := CASE WHEN p_player = 2
    THEN GREATEST(0, v_match.player2_score + p_delta)
    ELSE v_match.player2_score
  END;

  v_total_points := v_new_p1 + v_new_p2;
  v_is_deuce := v_new_p1 >= v_match.target_score - 1
             AND v_new_p2 >= v_match.target_score - 1;

  IF v_is_deuce THEN
    v_deuce_points := v_total_points - ((v_match.target_score - 1) * 2);
    v_server := CASE WHEN mod(v_deuce_points, 2) = 0
      THEN v_match.first_server
      ELSE CASE WHEN v_match.first_server = 1 THEN 2 ELSE 1 END
    END;
  ELSE
    v_service_block := floor(v_total_points / 2.0);
    v_server := CASE WHEN mod(v_service_block, 2) = 0
      THEN v_match.first_server
      ELSE CASE WHEN v_match.first_server = 1 THEN 2 ELSE 1 END
    END;
  END IF;

  -- Win-by-2 rule (standard table tennis)
  IF v_new_p1 >= v_match.target_score AND v_new_p1 - v_new_p2 >= 2 THEN
    v_winner_id := v_match.player1_id;
  ELSIF v_new_p2 >= v_match.target_score AND v_new_p2 - v_new_p1 >= 2 THEN
    v_winner_id := v_match.player2_id;
  ELSE
    v_winner_id := NULL;
  END IF;

  IF v_winner_id IS NOT NULL THEN
    -- -------------------------------------------------------
    -- Winner detected: finalize in a SINGLE atomic UPDATE.
    -- Goes directly from active → finished with no intermediate
    -- state visible to Realtime subscribers.
    -- -------------------------------------------------------
    UPDATE public.matches
    SET
      player1_score = v_new_p1,
      player2_score = v_new_p2,
      server        = v_server,
      winner_id     = v_winner_id,
      status        = 'finished',
      completed_at  = now(),
      updated_at    = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    -- Persist final stats for both players inline
    v_loser_id      := CASE WHEN v_winner_id = v_match.player1_id
      THEN v_match.player2_id ELSE v_match.player1_id END;
    v_winner_scored := CASE WHEN v_winner_id = v_match.player1_id
      THEN v_new_p1 ELSE v_new_p2 END;
    v_loser_scored  := CASE WHEN v_winner_id = v_match.player1_id
      THEN v_new_p2 ELSE v_new_p1 END;

    UPDATE public.player_stats
    SET
      matches_played        = matches_played + 1,
      matches_won           = matches_won + 1,
      total_points_scored   = total_points_scored + v_winner_scored,
      total_points_conceded = total_points_conceded + v_loser_scored,
      current_win_streak    = current_win_streak + 1,
      best_win_streak       = GREATEST(best_win_streak, current_win_streak + 1),
      updated_at            = now()
    WHERE profile_id = v_winner_id;

    UPDATE public.player_stats
    SET
      matches_played        = matches_played + 1,
      matches_lost          = matches_lost + 1,
      total_points_scored   = total_points_scored + v_loser_scored,
      total_points_conceded = total_points_conceded + v_winner_scored,
      current_win_streak    = 0,
      updated_at            = now()
    WHERE profile_id = v_loser_id;

  ELSE
    -- No winner yet — update scores and server only
    UPDATE public.matches
    SET
      player1_score = v_new_p1,
      player2_score = v_new_p2,
      server        = v_server,
      updated_at    = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;
  END IF;

  RETURN v_match;
END;
$$;


-- =============================================================
-- FIX 2: accept_match_request — always create a brand-new session
--
-- Previously: searched for any existing active session between the
-- same two players and returned its ID, reusing the old match.
-- Now: any existing active session is abandoned first, then a fresh
-- match is always inserted for every accepted challenge.
-- =============================================================

CREATE OR REPLACE FUNCTION public.accept_match_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request  public.match_requests%ROWTYPE;
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

  -- Idempotency: if this exact request was already processed, return
  -- the match that was created for it (safe network-retry path).
  IF v_request.status = 'accepted' AND v_request.match_id IS NOT NULL THEN
    RETURN v_request.match_id;
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  -- Abandon ALL existing active sessions between these two players.
  -- This guarantees every accepted challenge starts with a fresh session,
  -- even if a previous match was left in 'active' due to a lifecycle bug.
  UPDATE public.matches
  SET
    status       = 'abandoned',
    completed_at = COALESCE(completed_at, now()),
    updated_at   = now()
  WHERE status = 'active'
    AND (
      (player1_id = v_request.from_profile_id AND player2_id = v_request.to_profile_id)
      OR (player1_id = v_request.to_profile_id AND player2_id = v_request.from_profile_id)
    );

  -- Always insert a brand-new match for this accepted challenge.
  INSERT INTO public.matches (player1_id, player2_id, target_score, status)
  VALUES (v_request.from_profile_id, v_request.to_profile_id, v_request.target_score, 'active')
  RETURNING id INTO v_match_id;

  UPDATE public.match_requests
  SET
    status       = 'accepted',
    responded_at = now(),
    match_id     = v_match_id
  WHERE id = p_request_id;

  RETURN v_match_id;
END;
$$;


-- =============================================================
-- FIX 3: create_match_session — new RPC for direct match creation
--
-- Used by handleSelectOpponent and handleRematch on the client.
-- Abandons any active session between the same players first, then
-- inserts a fresh match. Replaces the bare client INSERT that would
-- fail silently on the unique-constraint when a live session existed.
-- =============================================================

CREATE OR REPLACE FUNCTION public.create_match_session(
  p_player1_id   uuid,
  p_player2_id   uuid,
  p_target_score integer DEFAULT 11
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
BEGIN
  -- Security: the authenticated user must own at least one of the profiles
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id IN (p_player1_id, p_player2_id)
      AND (user_id = auth.uid() OR (is_guest = true AND created_by = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: authenticated user is not related to either player';
  END IF;

  -- Abandon any active session between these players before creating a new one
  UPDATE public.matches
  SET
    status       = 'abandoned',
    completed_at = COALESCE(completed_at, now()),
    updated_at   = now()
  WHERE status = 'active'
    AND (
      (player1_id = p_player1_id AND player2_id = p_player2_id)
      OR (player1_id = p_player2_id AND player2_id = p_player1_id)
    );

  -- Insert a fresh match
  INSERT INTO public.matches (player1_id, player2_id, target_score, status)
  VALUES (p_player1_id, p_player2_id, p_target_score, 'active')
  RETURNING id INTO v_match_id;

  RETURN v_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_match_session(uuid, uuid, integer) TO authenticated;


-- =============================================================
-- FIX 4: Cleanup — matches stuck active with winner_id already set
--
-- These are rows left by the old two-step update_match_score: scores
-- + winner_id were written in the first UPDATE, but the subsequent
-- finalize_match_session call either never ran or its status change
-- was not committed. Transition them to 'finished' now.
-- NOTE: player_stats may be partially updated for these rows.
-- We correct the match status only to unblock new sessions.
-- =============================================================

UPDATE public.matches
SET
  status       = 'finished',
  completed_at = COALESCE(completed_at, now()),
  updated_at   = now()
WHERE status    = 'active'
  AND winner_id IS NOT NULL;


-- =============================================================
-- FIX 5: Cleanup — active matches where scores already satisfy
-- the win condition but winner_id was never recorded.
-- =============================================================

UPDATE public.matches
SET
  status       = 'finished',
  winner_id    = CASE
    WHEN player1_score >= target_score AND player1_score - player2_score >= 2
      THEN player1_id
    WHEN player2_score >= target_score AND player2_score - player1_score >= 2
      THEN player2_id
    ELSE NULL
  END,
  completed_at = COALESCE(completed_at, now()),
  updated_at   = now()
WHERE status    = 'active'
  AND winner_id IS NULL
  AND (
    (player1_score >= target_score AND player1_score - player2_score >= 2)
    OR (player2_score >= target_score AND player2_score - player1_score >= 2)
  );
