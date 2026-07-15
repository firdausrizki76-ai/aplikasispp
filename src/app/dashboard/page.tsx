"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardPage() {
  const [userName, setUserName] = useState("Memuat...");
  const [userRole, setUserRole] = useState("admin");
  const [totalSiswa, setTotalSiswa] = useState<number | string>("...");
  const [totalPembayaran, setTotalPembayaran] = useState<number | string>("...");
  const [totalTunggakan, setTotalTunggakan] = useState<number | string>("...");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setUserName(profile?.full_name || user.email?.split("@")[0] || "Admin");
        setUserRole(profile?.role || "admin");
      } else {
        setUserName("Admin");
        setUserRole("admin");
      }

      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setTotalSiswa(data.totalSiswa);
          setTotalPembayaran(data.totalPembayaran);
          setTotalTunggakan(data.totalTunggakan);
          setAuditLogs(data.auditLogs);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats via API", err);
      }
      setIsSyncing(false);
    };

    fetchData();
  }, []);

  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  if (isSyncing) {
    return (
      <div className="view-section h-[80vh] flex flex-col items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium tracking-wide">Memeriksa hak akses dan memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-section animate-page-transition">
      {/* Welcome Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            Selamat Datang, {userName}
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            Kelola keuangan sekolah dengan presisi dan transparansi.
          </p>
        </div>
        <div className="text-left md:text-right">
          <div className="font-title-md text-title-md text-primary" suppressHydrationWarning>
            {formattedDate}
          </div>
          <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">
            Sistem Aktif
          </div>
        </div>
      </div>

      {/* Summary Cards Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-lg">
        {/* Total Siswa */}
        <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border-l-4 border-primary">
          <div className="flex justify-between items-start mb-4">
            <span
              className="material-symbols-outlined text-primary bg-primary-fixed p-3 rounded-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              groups
            </span>
            <span className="text-green-600 font-bold font-label-md text-label-md flex items-center">
              Active
            </span>
          </div>
          <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
            Total Siswa Aktif
          </h3>
          <div className="font-display-lg text-display-lg text-primary">
            {totalSiswa || 0}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            Terdaftar di sistem
          </p>
        </div>

        {userRole === "pimpinan" ? (
          <>
            {/* Pembayaran Keseluruhan */}
            <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border-l-4 border-secondary">
              <div className="flex justify-between items-start mb-4">
                <span
                  className="material-symbols-outlined text-secondary bg-secondary-fixed p-3 rounded-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance_wallet
                </span>
                <div className="w-16 h-1 bg-surface-container-highest rounded-full overflow-hidden mt-4">
                  <div className="bg-secondary h-full w-[100%]"></div>
                </div>
              </div>
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                Total Pemasukan (SPP)
              </h3>
              <div className="font-display-lg text-display-lg text-secondary truncate">
                Rp {typeof totalPembayaran === 'number' ? totalPembayaran.toLocaleString("id-ID") : totalPembayaran}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Dari seluruh transaksi tercatat
              </p>
            </div>

            {/* Tunggakan Placeholder */}
            <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border-l-4 border-error">
              <div className="flex justify-between items-start mb-4">
                <span
                  className="material-symbols-outlined text-error bg-error-container p-3 rounded-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  report
                </span>
                <span className="text-error font-bold font-label-md text-label-md">
                  Aman
                </span>
              </div>
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                Tunggakan Berjalan
              </h3>
              <div className="font-display-lg text-display-lg text-error truncate">
                Rp {typeof totalTunggakan === 'number' ? totalTunggakan.toLocaleString("id-ID") : totalTunggakan}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Dari seluruh tagihan belum lunas
              </p>
            </div>
          </>
        ) : (
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant md:col-span-2 flex flex-col justify-center items-center text-center">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">lock</span>
            <p className="font-body-md text-on-surface-variant font-medium">Hanya pimpinan yang bisa melihat dan mengakses laporan keuangan ini. Silahkan hubungi pimpinan.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Form Input Section */}
        <section className="lg:col-span-5 space-y-gutter">
          <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] border border-outline-variant p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-primary text-3xl">
                payments
              </span>
            </div>
            <h3 className="font-title-lg text-title-lg text-primary">
              Input Pembayaran Baru
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              Catat transaksi pembayaran SPP dan uang sekolah dengan cepat.
            </p>
            <Link
              href="/dashboard/pembayaran"
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl shadow-lg hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">add_box</span>
              Buka Form Input
            </Link>
          </div>

          {/* Admin Info Card */}
          <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-xl text-on-primary shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-on-primary/30 flex items-center justify-center bg-white text-primary">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <div className="font-title-md text-title-md">{userName}</div>
                <p className="text-on-primary/70 text-body-md">Sesi aktif</p>
              </div>
              <div className="ml-auto bg-white/10 p-2 rounded-lg">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
            </div>
          </div>
        </section>

        {/* Table History Section */}
        <section className="lg:col-span-7">
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">
                  history
                </span>
                <h3 className="font-title-lg text-title-lg text-primary">
                  Riwayat Audit Terakhir
                </h3>
              </div>
              <Link
                href="/dashboard/audit"
                className="text-secondary font-bold font-label-md text-label-md hover:bg-secondary-container/20 px-3 py-2 rounded-lg transition-all"
              >
                Lihat Semua
              </Link>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                      Aksi
                    </th>
                    <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                      Tabel
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.map((log: any) => (
                      <tr
                        key={log.id}
                        className="hover:bg-surface-container-low/50"
                      >
                        <td className="px-6 py-4 text-sm text-on-surface" suppressHydrationWarning>
                          {new Date(log.created_at).toLocaleString("id-ID", {timeZone: 'Asia/Makassar'})}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-md font-bold ${
                              log.action === "INSERT"
                                ? "bg-green-100 text-green-700"
                                : log.action === "UPDATE"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {log.table_name === 'payment_transactions' && log.action === 'INSERT' ? 'Menerima Pembayaran' : 
                             log.table_name === 'student_bills' && log.action === 'UPDATE' ? 'Melunasi Tagihan' : 
                             log.action === 'INSERT' ? 'Menambahkan Data' : 
                             log.action === 'UPDATE' ? 'Mengubah Data' : 
                             log.action === 'DELETE' ? 'Menghapus Data' : log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface font-medium">
                          {log.table_name === 'students' ? 'Siswa' : 
                           log.table_name === 'payment_transactions' ? 'Transaksi Pembayaran' : 
                           log.table_name === 'student_bills' ? 'Tagihan Siswa' : 
                           `Tabel ${log.table_name}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-8 text-center text-sm text-gray-500"
                      >
                        Belum ada aktivitas di database
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* System Status Banner */}
      <div className="mt-12 p-4 bg-secondary-fixed text-on-secondary-fixed flex items-center justify-between rounded-lg border border-secondary-container">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px]">sync</span>
          <span className="font-label-md text-label-md">
            Data tersinkronisasi dengan Database (Supabase)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase">Server OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
