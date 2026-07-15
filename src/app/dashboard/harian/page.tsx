"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function HarianPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payment_transactions")
        .select(`
          *,
          students (name),
          profiles (full_name),
          student_bills (bulan_tagihan)
        `)
        .order("payment_date", { ascending: false });

      if (!error && data) {
        setTransactions(data);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, []);

  return (
    <>
      <div className="view-section">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Jurnal Transaksi Harian
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Semua input pembayaran tersimpan berurut di sini sebagai sumber
              data utama.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    WAKTU
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    ID TRANSAKSI
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    SISWA
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    TARGET
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    TIPE
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    NOMINAL
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    ADMIN
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    AKSI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-on-surface-variant"
                    >
                      Memuat data dari Supabase...
                    </td>
                  </tr>
                ) : transactions.length > 0 ? (
                  transactions.map((trx) => (
                    <tr key={trx.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4" suppressHydrationWarning>
                        <span className="text-sm">
                          {new Date(trx.payment_date).toLocaleDateString('en-GB', {timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', year: 'numeric'})} {new Date(trx.payment_date).toLocaleTimeString('id-ID', {timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit'})}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {trx.receipt_id}
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">
                        {trx.students?.name || 'Unknown Student'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {trx.student_bills?.bulan_tagihan || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs">
                          {trx.jenis_tagihan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">
                        Rp {Number(trx.amount).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {trx.profiles?.full_name || 'Admin'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="text-error hover:bg-error-container p-1.5 rounded-lg transition-colors" title="Hapus transaksi (Admin Only)">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-on-surface-variant"
                    >
                      Belum ada riwayat transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
