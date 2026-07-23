"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardPage() {
  const [userName, setUserName] = useState("Memuat...");
  const [userRole, setUserRole] = useState("admin");
  const [totalSiswa, setTotalSiswa] = useState<number | string>("...");
  const [totalPembayaran, setTotalPembayaran] = useState<number | string>("...");
  const [totalTunggakan, setTotalTunggakan] = useState<number | string>("Memuat...");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [rincianPemasukan, setRincianPemasukan] = useState<Record<string, Record<string, number>> | null>(null);
  const [rincianTunggakan, setRincianTunggakan] = useState<Record<string, Record<string, number>> | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [filterBulan, setFilterBulan] = useState("Semua");
  const [filterKomponen, setFilterKomponen] = useState("Semua");

  useEffect(() => {
    setIsMounted(true);
    const fetchData = async () => {
      const supabase = createClient();
      
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
        let cachedData = null;
        try {
          const cached = sessionStorage.getItem('dashboard_cache_v3');
          if (cached) cachedData = JSON.parse(cached);
        } catch (e) {}

        if (cachedData) {
          setTotalSiswa(cachedData.totalSiswa);
          setTotalPembayaran(cachedData.totalPembayaran);
          setTotalTunggakan(cachedData.totalTunggakan);
          setRincianPemasukan(cachedData.rincianPemasukan || null);
          setRincianTunggakan(cachedData.rincianTunggakan || null);
          setAuditLogs(cachedData.auditLogs);
          setIsSyncing(false);
        }

        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const freshData = await response.json();
          try { sessionStorage.setItem('dashboard_cache_v3', JSON.stringify(freshData)); } catch (e) {}
          
          setTotalSiswa(freshData.totalSiswa);
          setTotalPembayaran(freshData.totalPembayaran);
          setTotalTunggakan(freshData.totalTunggakan);
          setRincianPemasukan(freshData.rincianPemasukan || null);
          setRincianTunggakan(freshData.rincianTunggakan || null);
          setAuditLogs(freshData.auditLogs);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats via API", err);
      }
      setIsSyncing(false);
    };

    fetchData();
  }, []);

  const availableBulan = useMemo(() => {
    const set = new Set<string>();
    if (rincianPemasukan) Object.keys(rincianPemasukan).forEach(b => set.add(b));
    if (rincianTunggakan) Object.keys(rincianTunggakan).forEach(b => set.add(b));
    
    const monthOrder: Record<string, number> = {
      "Januari": 1, "Februari": 2, "Maret": 3, "April": 4, "Mei": 5, "Juni": 6, 
      "Juli": 7, "Agustus": 8, "September": 9, "Oktober": 10, "November": 11, "Desember": 12
    };

    return ["Semua", ...Array.from(set).sort((a, b) => {
      const [mA, yA] = a.split(" ");
      const [mB, yB] = b.split(" ");
      if (yA !== yB) return Number(yA) - Number(yB);
      return (monthOrder[mA] || 0) - (monthOrder[mB] || 0);
    })];
  }, [rincianPemasukan, rincianTunggakan]);

  const availableKomponen = useMemo(() => {
    const set = new Set<string>();
    if (rincianPemasukan) Object.values(rincianPemasukan).forEach(k => Object.keys(k).forEach(c => set.add(c)));
    if (rincianTunggakan) Object.values(rincianTunggakan).forEach(k => Object.keys(k).forEach(c => set.add(c)));
    return [
      "Semua", 
      "SPP SD (Semua Kelas)", 
      "SPP SMP (Semua Kelas)", 
      ...Array.from(set).sort()
    ];
  }, [rincianPemasukan, rincianTunggakan]);

  const displayedPembayaran = useMemo(() => {
    if (!rincianPemasukan) return totalPembayaran;
    if (filterBulan === "Semua" && filterKomponen === "Semua") return totalPembayaran;
    
    let sum = 0;
    Object.entries(rincianPemasukan).forEach(([bulan, komponenDict]) => {
      if (filterBulan !== "Semua" && bulan !== filterBulan) return;
      Object.entries(komponenDict).forEach(([komp, amount]) => {
        let isMatch = false;
        if (filterKomponen === "Semua") {
          isMatch = true;
        } else if (filterKomponen === "SPP SD (Semua Kelas)") {
          isMatch = /^SPP KELAS [1-6]$/i.test(komp);
        } else if (filterKomponen === "SPP SMP (Semua Kelas)") {
          isMatch = /^SPP KELAS [7-9]$/i.test(komp);
        } else {
          isMatch = komp === filterKomponen;
        }

        if (isMatch) sum += amount;
      });
    });
    return sum;
  }, [filterBulan, filterKomponen, rincianPemasukan, totalPembayaran]);

  const displayedTunggakan = useMemo(() => {
    if (!rincianTunggakan) return totalTunggakan;
    if (filterBulan === "Semua" && filterKomponen === "Semua") return totalTunggakan;
    
    let sum = 0;
    Object.entries(rincianTunggakan).forEach(([bulan, komponenDict]) => {
      if (filterBulan !== "Semua" && bulan !== filterBulan) return;
      Object.entries(komponenDict).forEach(([komp, amount]) => {
        let isMatch = false;
        if (filterKomponen === "Semua") {
          isMatch = true;
        } else if (filterKomponen === "SPP SD (Semua Kelas)") {
          isMatch = /^SPP KELAS [1-6]$/i.test(komp);
        } else if (filterKomponen === "SPP SMP (Semua Kelas)") {
          isMatch = /^SPP KELAS [7-9]$/i.test(komp);
        } else {
          isMatch = komp === filterKomponen;
        }

        if (isMatch) sum += amount;
      });
    });
    return sum;
  }, [filterBulan, filterKomponen, rincianTunggakan, totalTunggakan]);

  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  if (isSyncing || !isMounted) {
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

      {userRole === "pimpinan" && (
        <div className="flex flex-col md:flex-row gap-4 animate-page-transition mb-stack-lg">
          <div className="flex flex-col flex-1">
            <label className="font-label-sm text-on-surface-variant mb-1 font-bold">Filter Berdasarkan Bulan Tagihan</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">calendar_month</span>
              <select 
                value={filterBulan}
                onChange={(e) => setFilterBulan(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-primary focus:border-primary block p-2.5 pl-10"
              >
                {availableBulan.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col flex-1">
            <label className="font-label-sm text-on-surface-variant mb-1 font-bold">Filter Berdasarkan Komponen</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">category</span>
              <select 
                value={filterKomponen}
                onChange={(e) => setFilterKomponen(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-primary focus:border-primary block p-2.5 pl-10"
              >
                {availableKomponen.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-lg animate-page-transition" style={{animationDelay: '100ms'}}>
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
            <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border-l-4 border-secondary">
              <div className="flex justify-between items-start mb-4">
                <span
                  className="material-symbols-outlined text-secondary bg-secondary-fixed p-3 rounded-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance_wallet
                </span>
                <span className="font-label-sm font-bold text-secondary uppercase tracking-wider">Total Pemasukan {filterKomponen !== "Semua" ? `(${filterKomponen})` : 'Keseluruhan'}</span>
              </div>
              <div className="w-10 h-1 rounded-full bg-secondary"></div>
              <h3 className="font-title-lg text-title-lg text-on-surface mt-4">
                Total Pemasukan {filterBulan !== "Semua" ? filterBulan : ''}
              </h3>
              <div className="text-2xl lg:text-3xl font-black text-secondary break-words mt-1">
                Rp {typeof displayedPembayaran === 'number' ? displayedPembayaran.toLocaleString("id-ID") : displayedPembayaran}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Dari seluruh transaksi tercatat {filterBulan !== "Semua" || filterKomponen !== "Semua" ? 'sesuai filter' : ''}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-error">error</span>
                <span className="font-label-sm font-bold text-error uppercase tracking-wider">Tunggakan Berjalan {filterKomponen !== "Semua" ? `(${filterKomponen})` : ''}</span>
              </div>
              <div className="w-10 h-1 rounded-full bg-error"></div>
              <h3 className="font-title-lg text-title-lg text-on-surface mt-4">
                Tunggakan {filterBulan !== "Semua" ? filterBulan : 'Berjalan'}
              </h3>
              <div className="text-2xl lg:text-3xl font-black text-error break-words mt-1">
                Rp {typeof displayedTunggakan === 'number' ? displayedTunggakan.toLocaleString("id-ID") : displayedTunggakan}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Dari seluruh tagihan belum lunas {filterBulan !== "Semua" || filterKomponen !== "Semua" ? 'sesuai filter' : ''}
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
                          {new Date(log.created_at).toLocaleString("id-ID", {timeZone: 'Asia/Jakarta'})}
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
