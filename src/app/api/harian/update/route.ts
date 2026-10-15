import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertAuditLog } from "@/utils/audit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { trx_id, sourceType = "SPP", payment_method, payment_date, notes, userId } = await req.json();

    if (!trx_id) {
      return NextResponse.json({ success: false, error: "ID Transaksi diperlukan" }, { status: 400 });
    }

    if (!payment_method) {
      return NextResponse.json({ success: false, error: "Metode pembayaran harus dipilih" }, { status: 400 });
    }

    const normalizedMethod = payment_method.toUpperCase();
    if (!["TUNAI", "TRANSFER"].includes(normalizedMethod)) {
      return NextResponse.json({ success: false, error: "Metode pembayaran harus TUNAI atau TRANSFER" }, { status: 400 });
    }

    let parsedDateIso: string | undefined;
    if (payment_date) {
      const d = new Date(payment_date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ success: false, error: "Format tanggal tidak valid" }, { status: 400 });
      }
      parsedDateIso = d.toISOString();
    }

    if (sourceType === "SPP") {
      const { data: existingTrx, error: findErr } = await supabaseAdmin
        .from("payment_transactions")
        .select("id, receipt_id, payment_method, payment_date")
        .eq("id", trx_id)
        .single();

      if (findErr || !existingTrx) {
        return NextResponse.json({ success: false, error: "Transaksi SPP tidak ditemukan" }, { status: 404 });
      }

      const updatePayload: Record<string, any> = {
        payment_method: normalizedMethod,
      };
      if (parsedDateIso) {
        updatePayload.payment_date = parsedDateIso;
      }

      const { error: updateErr } = await supabaseAdmin
        .from("payment_transactions")
        .update(updatePayload)
        .eq("id", trx_id);

      if (updateErr) throw updateErr;

      if (userId) {
        await insertAuditLog(
          supabaseAdmin,
          userId,
          "Edit Transaksi",
          "payment_transactions",
          `Mengubah transaksi ${existingTrx.receipt_id}: Metode ${existingTrx.payment_method || 'TUNAI'} -> ${normalizedMethod}${parsedDateIso ? `, Tanggal diubah` : ''}`
        );
      }
    } else if (sourceType === "PSB") {
      const { data: existingTrx, error: findErr } = await supabaseAdmin
        .from("psb_installments")
        .select("id, receipt_no, payment_method, payment_date")
        .eq("id", trx_id)
        .single();

      if (findErr || !existingTrx) {
        return NextResponse.json({ success: false, error: "Transaksi PSB tidak ditemukan" }, { status: 404 });
      }

      const updatePayload: Record<string, any> = {
        payment_method: normalizedMethod,
      };
      if (parsedDateIso) {
        updatePayload.payment_date = parsedDateIso;
      }
      if (notes !== undefined) {
        updatePayload.notes = notes;
      }

      const { error: updateErr } = await supabaseAdmin
        .from("psb_installments")
        .update(updatePayload)
        .eq("id", trx_id);

      if (updateErr) throw updateErr;

      if (userId) {
        await insertAuditLog(
          supabaseAdmin,
          userId,
          "Edit Transaksi",
          "psb_installments",
          `Mengubah kwitansi PSB ${existingTrx.receipt_no}: Metode ${existingTrx.payment_method || 'TUNAI'} -> ${normalizedMethod}`
        );
      }
    } else if (sourceType === "SERAGAM") {
      const { data: existingTrx, error: findErr } = await supabaseAdmin
        .from("sales")
        .select("id, item_name, payment_method, created_at")
        .eq("id", trx_id)
        .single();

      if (findErr || !existingTrx) {
        return NextResponse.json({ success: false, error: "Transaksi penjualan seragam tidak ditemukan" }, { status: 404 });
      }

      const updatePayload: Record<string, any> = {
        payment_method: normalizedMethod,
      };
      if (parsedDateIso) {
        updatePayload.created_at = parsedDateIso;
      }

      const { error: updateErr } = await supabaseAdmin
        .from("sales")
        .update(updatePayload)
        .eq("id", trx_id);

      if (updateErr) throw updateErr;

      if (userId) {
        await insertAuditLog(
          supabaseAdmin,
          userId,
          "Edit Transaksi",
          "sales",
          `Mengubah penjualan seragam (${existingTrx.item_name}): Metode ${existingTrx.payment_method || 'TUNAI'} -> ${normalizedMethod}`
        );
      }
    } else {
      return NextResponse.json({ success: false, error: "Tipe sumber transaksi tidak valid" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Transaksi berhasil diperbarui" });
  } catch (error: any) {
    console.error("Error in update transaction:", error);
    return NextResponse.json({ success: false, error: error.message || "Gagal memperbarui transaksi" }, { status: 500 });
  }
}
