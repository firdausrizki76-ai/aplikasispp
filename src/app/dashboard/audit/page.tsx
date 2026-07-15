"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";

type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuditLogWithProfile extends AuditLog {
  profiles?: { full_name: string } | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLogs(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClearLog = async () => {
    if (!window.confirm("PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH riwayat log audit ini? Tindakan ini tidak dapat dibatalkan!")) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/audit/clear', {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus log audit");
      }

      alert("Log audit berhasil dihapus sepenuhnya.");
      fetchLogs();
    } catch (err: any) {
      alert("Gagal menghapus log audit: " + err.message);
    }
    setLoading(false);
  };

  const getActionColor = (action: string) => {
    switch(action) {
      case 'INSERT': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  
  const getActionText = (log: AuditLogWithProfile) => {
    if (log.table_name === 'payment_transactions' && log.action === 'INSERT') {
      return 'Menerima Pembayaran';
    }
    if (log.table_name === 'student_bills' && log.action === 'UPDATE') {
      return 'Melunasi Tagihan';
    }
    if (log.table_name === 'sales' && log.action === 'INSERT') {
      return 'Transaksi Seragam Baru';
    }
    if (log.table_name === 'inventory') {
      if (log.action === 'INSERT') return 'Menambah Stok Seragam';
      if (log.action === 'UPDATE') return 'Mengubah Stok Seragam';
      if (log.action === 'DELETE') return 'Menghapus Seragam';
    }
    
    switch(log.action) {
      case 'INSERT': return 'Menambahkan Data';
      case 'UPDATE': return 'Mengubah Data';
      case 'DELETE': return 'Menghapus Data';
      default: return log.action;
    }
  };

  const formatDataInfo = (log: AuditLogWithProfile) => {
    let details = "";
    if (log.table_name === 'students') {
       details = `Siswa`;
    } else if (log.table_name === 'payment_transactions') {
       details = `Transaksi Pembayaran`;
    } else if (log.table_name === 'student_bills') {
       details = `Tagihan Siswa`;
    } else if (log.table_name === 'sales') {
       details = `Penjualan Seragam`;
    } else if (log.table_name === 'inventory') {
       details = `Data Master Seragam`;
    } else {
       details = `Tabel ${log.table_name}`;
    }
    return details;
  };

  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    const user = log.profiles?.full_name?.toLowerCase() || "";
    const table = log.table_name.toLowerCase();
    return user.includes(s) || table.includes(s) || log.action.toLowerCase().includes(s);
  });

  return (
    <div className="view-section">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Log Audit</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            Rekaman jejak seluruh aktivitas penambahan, perubahan, dan penghapusan data di dalam sistem.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface focus:ring-primary focus:border-primary outline-none"
              placeholder="Cari admin atau aktivitas..." 
            />
          </div>
          <button onClick={fetchLogs} className="border border-outline-variant hover:bg-surface-container-low text-on-surface px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-sm">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
          <button onClick={handleClearLog} className="bg-error hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-sm">
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            Hapus Record
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Waktu</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Pengguna (Admin)</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Aktivitas</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Target Data</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">Memuat data log dari database...</td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-surface-container-low/30">
                    <td className="px-6 py-4 font-medium" suppressHydrationWarning>
                      <div className="text-on-surface">{new Date(log.created_at).toLocaleDateString('id-ID', {timeZone: 'Asia/Makassar', day: '2-digit', month:'short', year:'numeric'})}</div>
                      <div className="text-xs text-on-surface-variant">{new Date(log.created_at).toLocaleTimeString('id-ID', {timeZone: 'Asia/Makassar'})}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs uppercase">
                          {(log.profiles?.full_name || 'U').substring(0,2)}
                        </div>
                        <span className="font-bold">{log.profiles?.full_name || 'Unknown Admin'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getActionColor(log.action)}`}>
                        {getActionText(log)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatDataInfo(log)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => alert(JSON.stringify({before: log.old_data, after: log.new_data}, null, 2))}
                        className="text-primary hover:text-primary-container font-bold text-xs underline"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-on-surface-variant flex flex-col items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-outline">history</span>
                    <p className="font-bold text-lg text-on-surface">Belum ada aktivitas</p>
                    <p>Sistem akan merekam setiap aktivitas penambahan, perubahan, dan penghapusan di sini.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
