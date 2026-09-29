-- Atomic RPC function for bill payment with row-level locking (FOR UPDATE)
-- to strictly prevent duplicate payment records
CREATE OR REPLACE FUNCTION public.pay_student_bills(
  p_student_id uuid,
  p_bills jsonb,
  p_admin_id uuid DEFAULT NULL,
  p_receipt_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_bill_item jsonb;
  v_bill_id uuid;
  v_pay_amount numeric;
  v_current_nominal numeric;
  v_current_status text;
  v_jenis_tagihan text;
  v_bulan_tagihan text;
  v_new_nominal numeric;
  v_new_status text;
  v_receipt_id text;
  v_count int := 0;
  v_student_name text;
BEGIN
  -- Generate receipt ID if not provided
  IF p_receipt_id IS NULL OR p_receipt_id = '' THEN
    v_receipt_id := 'TRX-' || floor(extract(epoch from now()) * 1000)::text;
  ELSE
    v_receipt_id := p_receipt_id;
  END IF;

  -- Get student name
  SELECT name INTO v_student_name FROM public.students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Siswa tidak ditemukan');
  END IF;

  -- Loop through each bill to pay
  FOR v_bill_item IN SELECT * FROM jsonb_array_elements(p_bills)
  LOOP
    v_bill_id := (v_bill_item->>'billId')::uuid;
    v_pay_amount := (v_bill_item->>'amount')::numeric;

    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Lock the bill row exclusively to prevent any concurrent double payment!
    SELECT nominal, status, jenis_tagihan, bulan_tagihan 
    INTO v_current_nominal, v_current_status, v_jenis_tagihan, v_bulan_tagihan
    FROM public.student_bills
    WHERE id = v_bill_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tagihan dengan ID % tidak ditemukan', v_bill_id;
    END IF;

    -- Strict validation against already paid bill
    IF v_current_status = 'Lunas' OR v_current_nominal <= 0 THEN
      RAISE EXCEPTION 'Tagihan "% %" sudah lunas atau baru saja dibayar. Pembayaran dibatalkan untuk mencegah pencatatan ganda.', v_jenis_tagihan, v_bulan_tagihan;
    END IF;

    -- Cap payment amount if exceeds nominal
    IF v_pay_amount > v_current_nominal THEN
      v_pay_amount := v_current_nominal;
    END IF;

    v_new_nominal := v_current_nominal - v_pay_amount;
    IF v_new_nominal <= 0 THEN
      v_new_status := 'Lunas';
      v_new_nominal := 0;
    ELSE
      v_new_status := 'Belum Lunas';
    END IF;

    -- 1. Insert transaction
    INSERT INTO public.payment_transactions (
      receipt_id,
      student_id,
      bill_id,
      jenis_tagihan,
      amount,
      admin_id
    ) VALUES (
      v_receipt_id,
      p_student_id,
      v_bill_id,
      v_jenis_tagihan || ' ' || COALESCE(v_bulan_tagihan, ''),
      v_pay_amount,
      p_admin_id
    );

    -- 2. Update bill status & nominal
    UPDATE public.student_bills
    SET nominal = v_new_nominal,
        status = v_new_status
    WHERE id = v_bill_id;

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak ada tagihan valid yang dibayarkan');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'receiptId', v_receipt_id,
    'count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
