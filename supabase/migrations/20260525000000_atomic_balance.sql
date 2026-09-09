-- Atomic balance adjustment — prevents race conditions from concurrent
-- read-modify-write patterns in the application layer.
-- Called via supabase.rpc('adjust_kid_balance', { p_kid_id, p_delta })
CREATE OR REPLACE FUNCTION adjust_kid_balance(
  p_kid_id UUID,
  p_delta NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE kids
  SET balance = balance + p_delta
  WHERE id = p_kid_id
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid not found: %', p_kid_id;
  END IF;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic coin adjustment for rewards/quiz
CREATE OR REPLACE FUNCTION adjust_kid_coins(
  p_kid_id UUID,
  p_delta INTEGER
) RETURNS INTEGER AS $$
DECLARE
  new_coins INTEGER;
BEGIN
  UPDATE kids
  SET coins = coins + p_delta
  WHERE id = p_kid_id
  RETURNING coins INTO new_coins;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid not found: %', p_kid_id;
  END IF;

  IF new_coins < 0 THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  RETURN new_coins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
