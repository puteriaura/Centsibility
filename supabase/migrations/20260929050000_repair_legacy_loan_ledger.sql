-- Migration: 20260929050000_repair_legacy_loan_ledger.sql
-- Purpose:
--   One-off data repair for pre-T3 legacy loan ledger rows.
--   Before T3, loan approvals wrote net QARD (amount - 5.50) alongside separate 3.00 and 2.50 WITHDRAWAL fee rows.
--   This repair upgrades old loan disbursements to gross amount, re-labels fee rows as FEE, links them to the loan_id,
--   scales/deletes fees for loans under RM5.50, and asserts ledger consistency.
--
-- IMPORTANT:
--   - TAKE A DATABASE BACKUP FIRST before applying this migration in production.
--   - This function is idempotent: it strictly targets rows where loan_id IS NULL.
--   - Each loan is repaired inside its own subtransaction savepoint. Inconsistent loans that fail
--     the consistency check or encounter errors are safely skipped and left untouched for manual review.
--   - To list inconsistent loan transaction IDs, re-run:
--       SELECT public.repair_legacy_loan_ledger();
--     It is idempotent and returns the IDs again in the inconsistent_tx_ids array.
--   - To list every legacy row still unlinked (unmatched plus inconsistent), run:
--       SELECT * FROM public.transactions WHERE type = 'QARD' AND label LIKE 'Qard approved:%' AND loan_id IS NULL;
--   - The migration raises a NOTICE with {"repaired": n, "unmatched": m, "inconsistent": k, "fee_rows_deleted": d, "inconsistent_tx_ids": [...]}.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.repair_legacy_loan_ledger();
--   (Data modifications cannot be automatically undone without restoring the database backup)

CREATE OR REPLACE FUNCTION public.repair_legacy_loan_ledger()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_disb record;
  v_loan record;
  v_service_row record;
  v_processing_row record;
  v_target_service numeric;
  v_target_processing numeric;
  v_check_net numeric;
  v_repaired int := 0;
  v_unmatched int := 0;
  v_inconsistent int := 0;
  v_fee_deleted int := 0;
  v_loan_fee_deleted int;
  v_inconsistent_tx_ids uuid[] := '{}';
  v_res jsonb;
BEGIN
  FOR r_disb IN (
    SELECT id, kid_id, amount, created_at, label
      FROM public.transactions
     WHERE type = 'QARD'
       AND label LIKE 'Qard approved:%'
       AND loan_id IS NULL
     ORDER BY created_at ASC
  ) LOOP
    BEGIN
      -- 1. Match loan row
      SELECT l.id, l.amount, l.created_at
        INTO v_loan
        FROM public.loans l
       WHERE l.kid_id = r_disb.kid_id
         AND abs(extract(epoch from (l.created_at - r_disb.created_at))) <= 60
         AND greatest(0, round(l.amount - 5.50, 2)) = round(r_disb.amount, 2)
         AND NOT EXISTS (
           SELECT 1 FROM public.transactions t
            WHERE t.loan_id = l.id
              AND t.type = 'QARD'
         )
       ORDER BY abs(extract(epoch from (l.created_at - r_disb.created_at))) ASC, l.created_at ASC
       LIMIT 1;

      IF NOT FOUND THEN
        v_unmatched := v_unmatched + 1;
        CONTINUE;
      END IF;

      -- 2. Match fee rows within +- 60s
      SELECT id, amount, created_at
        INTO v_service_row
        FROM public.transactions
       WHERE kid_id = r_disb.kid_id
         AND type IN ('WITHDRAWAL', 'FEE')
         AND label = 'Loan service fee'
         AND loan_id IS NULL
         AND abs(extract(epoch from (created_at - r_disb.created_at))) <= 60
       ORDER BY abs(extract(epoch from (created_at - r_disb.created_at))) ASC, created_at ASC
       LIMIT 1;

      SELECT id, amount, created_at
        INTO v_processing_row
        FROM public.transactions
       WHERE kid_id = r_disb.kid_id
         AND type IN ('WITHDRAWAL', 'FEE')
         AND label = 'Loan processing fee'
         AND loan_id IS NULL
         AND abs(extract(epoch from (created_at - r_disb.created_at))) <= 60
       ORDER BY abs(extract(epoch from (created_at - r_disb.created_at))) ASC, created_at ASC
       LIMIT 1;

      -- Reset local fee deletions counter for this loan
      v_loan_fee_deleted := 0;

      -- 3. Determine target fee amounts
      IF v_loan.amount < 5.50 THEN
        v_target_service := least(3.00, v_loan.amount);
        v_target_processing := least(2.50, greatest(0, v_loan.amount - v_target_service));
      ELSE
        v_target_service := 3.00;
        v_target_processing := 2.50;
      END IF;

      -- 4. Repair disbursement
      UPDATE public.transactions
         SET amount = v_loan.amount,
             loan_id = v_loan.id
       WHERE id = r_disb.id;

      -- 5. Repair or delete service fee
      IF v_service_row.id IS NOT NULL THEN
        IF v_target_service = 0 THEN
          DELETE FROM public.transactions WHERE id = v_service_row.id;
          v_loan_fee_deleted := v_loan_fee_deleted + 1;
        ELSE
          UPDATE public.transactions
             SET type = 'FEE',
                 amount = v_target_service,
                 loan_id = v_loan.id
           WHERE id = v_service_row.id;
        END IF;
      END IF;

      -- 6. Repair or delete processing fee
      IF v_processing_row.id IS NOT NULL THEN
        IF v_target_processing = 0 THEN
          DELETE FROM public.transactions WHERE id = v_processing_row.id;
          v_loan_fee_deleted := v_loan_fee_deleted + 1;
        ELSE
          UPDATE public.transactions
             SET type = 'FEE',
                 amount = v_target_processing,
                 loan_id = v_loan.id
           WHERE id = v_processing_row.id;
        END IF;
      END IF;

      -- 7. Consistency check: disbursement minus fees must equal original net
      v_check_net := v_loan.amount - coalesce(
        (SELECT sum(amount) FROM public.transactions WHERE loan_id = v_loan.id AND type = 'FEE'),
        0
      );

      IF round(v_check_net, 2) <> round(r_disb.amount, 2) THEN
        RAISE EXCEPTION 'Consistency check failed for loan %: expected net %, got %', v_loan.id, r_disb.amount, v_check_net;
      END IF;

      -- Successful repair for this loan
      v_repaired := v_repaired + 1;
      v_fee_deleted := v_fee_deleted + v_loan_fee_deleted;

    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping loan repair for tx %: %', r_disb.id, SQLERRM;
      v_inconsistent := v_inconsistent + 1;
      v_inconsistent_tx_ids := array_append(v_inconsistent_tx_ids, r_disb.id);
    END;
  END LOOP;

  v_res := jsonb_build_object(
    'repaired', v_repaired,
    'unmatched', v_unmatched,
    'inconsistent', v_inconsistent,
    'fee_rows_deleted', v_fee_deleted,
    'inconsistent_tx_ids', to_jsonb(v_inconsistent_tx_ids)
  );

  RAISE NOTICE 'repair_legacy_loan_ledger completed: %', v_res;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_legacy_loan_ledger() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_legacy_loan_ledger() TO service_role;

-- Run one-off repair on migration apply
SELECT public.repair_legacy_loan_ledger();
