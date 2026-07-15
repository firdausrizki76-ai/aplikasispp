"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import * as XLSX from "xlsx";

export default function TutupBukuPage() {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleExport = async (table: string, filename: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.from(table).select("*");
    
    if (error) {
      alert("Gagal mengexport data: " + error.message);
    } else if (data && data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
      XLSX.writeFile(workbook, filename.replace('.csv', '.xlsx'));
    } else {
      alert("Data kosong.");
    }
    setLoading(false);
  };

  const handleTutupBuku = async () => {
    const confirm1 = window.confirm("PERINGATAN KERAS!\n\nTindakan ini akan mengosongkan seluruh riwayat pembayaran, mereset tagihan, dan menaikkan kelas siswa secara otomatis.\n\nApakah Anda YAKIN sudah mengunduh semua arsip Excel?");
    if (!confirm1) return;

    const confirm2 = window.confirm("Apakah Anda benar-benar yakin ingin melakukan PROSES TUTUP BUKU sekarang?");
    if (!confirm2) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/tutup-buku', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal memproses tutup buku");

      alert("SUKSES: " + data.message + "\n\nSiswa telah naik kelas dan riwayat tagihan telah di-reset.");
      window.location.reload();
    } catch (err: any) {
      alert("ERROR: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="view-section h-full flex flex-col fade-in">
        <div className="mb-8">
          <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-4xl">inventory_2</span>
            Tutup Buku & Arsip
          </h2>
          <p className="text-on-surface-variant font-body-lg mt-2 text-body-lg max-w-3xl">
            Gunakan fitur ini pada akhir tahun ajaran. Anda dapat mengunduh seluruh arsip data sistem sebelum melakukan reset untuk tahun ajaran baru.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant flex flex-col items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">badge</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-on-surface">Arsip Data Siswa</h3>
              <p className="text-on-surface-variant text-sm mt-1">Unduh seluruh master data siswa beserta jenjang dan kelas.</p>
            </div>
            <button 
              onClick={() => handleExport('students', 'arsip_siswa.csv')}
              disabled={loading}
              className="mt-auto px-4 py-2 border border-blue-200 text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-colors w-full flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span> Download
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant flex flex-col items-start gap-4">
            <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-on-surface">Arsip Transaksi SPP</h3>
              <p className="text-on-surface-variant text-sm mt-1">Unduh seluruh catatan transaksi pembayaran masuk (Uang SPP, PSB, dll).</p>
            </div>
            <button 
              onClick={() => handleExport('payment_transactions', 'arsip_transaksi.csv')}
              disabled={loading}
              className="mt-auto px-4 py-2 border border-green-200 text-green-700 font-bold rounded-lg hover:bg-green-50 transition-colors w-full flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span> Download
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant flex flex-col items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">checkroom</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-on-surface">Arsip Penjualan Seragam</h3>
              <p className="text-on-surface-variant text-sm mt-1">Unduh laporan stok terjual dari inventaris seragam sekolah.</p>
            </div>
            <button 
              onClick={() => handleExport('sales', 'arsip_seragam.csv')}
              disabled={loading}
              className="mt-auto px-4 py-2 border border-amber-200 text-amber-700 font-bold rounded-lg hover:bg-amber-50 transition-colors w-full flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span> Download
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant flex flex-col items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">history_edu</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-on-surface">Arsip Log Audit</h3>
              <p className="text-on-surface-variant text-sm mt-1">Unduh seluruh riwayat aktivitas admin dalam sistem secara komprehensif.</p>
            </div>
            <button 
              onClick={() => handleExport('audit_logs', 'arsip_audit_logs.csv')}
              disabled={loading}
              className="mt-auto px-4 py-2 border border-purple-200 text-purple-700 font-bold rounded-lg hover:bg-purple-50 transition-colors w-full flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span> Download
            </button>
          </div>
        </div>

        <div className="bg-error-container/20 rounded-2xl p-8 border border-error/30 mt-auto">
          <div className="flex gap-4">
            <span className="material-symbols-outlined text-error text-3xl">warning</span>
            <div>
              <h3 className="font-bold text-error text-xl mb-2">Reset Tahun Ajaran (Danger Zone)</h3>
              <p className="text-on-surface-variant mb-6 max-w-4xl">
                Tindakan ini akan mengosongkan seluruh riwayat pembayaran, mereset tagihan ke kondisi awal, dan menaikkan kelas siswa. Pastikan Anda telah <strong>mengunduh semua arsip di atas</strong> sebelum melakukan reset.
              </p>
              <button 
                onClick={handleTutupBuku}
                disabled={processing || loading}
                className="bg-error hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors shadow disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {processing ? 'hourglass_empty' : 'delete_forever'}
                </span>
                {processing ? 'Memproses Tutup Buku...' : 'Proses Tutup Buku & Reset'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
