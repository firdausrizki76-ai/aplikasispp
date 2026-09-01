"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

export default function HarianPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [userRole, setUserRole] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "this_month" | "last_month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedBillType, setSelectedBillType] = useState("all");
  const [selectedAdmin, setSelectedAdmin] = useState("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "student_asc">("date_desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setLoadingProgress(0);
    const supabase = createClient();
    
    try {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("payment_transactions")
          .select(`
            *,
            students (id, name, grade_level),
            profiles (id, full_name),
            student_bills (bulan_tagihan, jenis_tagihan)
          `)
          .order("payment_date", { ascending: false })
          .range(from, from + step - 1);

        if (error) {
          console.error("Error fetching transactions:", error);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          setLoadingProgress(allData.length);
          if (data.length < step) break;
        } else {
          break;
        }
        from += step;
      }

      setTransactions(allData);
    } catch (err) {
      console.error("Error in fetchTransactions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserRole = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserRole(user.user_metadata?.role || '');
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchUserRole();
  }, []);

  // Set default dates when switching quick period
  const handlePeriodChange = (type: "all" | "today" | "this_month" | "last_month" | "custom") => {
    setPeriodFilter(type);
    setCurrentPage(1);

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    if (type === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === "this_month") {
      const start = new Date(y, m, 1).toISOString().slice(0, 10);
      const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (type === "last_month") {
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (type === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Extract distinct bill types and admins for dropdowns
  const availableBillTypes = useMemo(() => {
    const types = new Set<string>();
    transactions.forEach(t => {
      if (t.jenis_tagihan) types.add(t.jenis_tagihan);
    });
    return Array.from(types).sort();
  }, [transactions]);

  const availableAdmins = useMemo(() => {
    const admins = new Set<string>();
    transactions.forEach(t => {
      const name = t.profiles?.full_name;
      if (name) admins.add(name);
    });
    return Array.from(admins).sort();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const receipt = (trx.receipt_id || "").toLowerCase();
        const student = (trx.students?.name || "").toLowerCase();
        const admin = (trx.profiles?.full_name || "").toLowerCase();
        const billMonth = (trx.student_bills?.bulan_tagihan || "").toLowerCase();
        const billType = (trx.jenis_tagihan || "").toLowerCase();
        
        const match = receipt.includes(query) || 
                      student.includes(query) || 
                      admin.includes(query) || 
                      billMonth.includes(query) || 
                      billType.includes(query);
        if (!match) return false;
      }

      // 2. Date Filtering
      if (periodFilter !== "all") {
        if (startDate) {
          const trxDate = (trx.payment_date || "").slice(0, 10);
          if (trxDate < startDate) return false;
        }
        if (endDate) {
          const trxDate = (trx.payment_date || "").slice(0, 10);
          if (trxDate > endDate) return false;
        }
      }

      // 3. Jenjang Filter
      if (selectedGrade !== "all") {
        const grade = trx.students?.grade_level || "";
        if (grade !== selectedGrade) return false;
      }

      // 4. Jenis Tagihan Filter
      if (selectedBillType !== "all") {
        if (trx.jenis_tagihan !== selectedBillType) return false;
      }

      // 5. Admin Filter
      if (selectedAdmin !== "all") {
        const adminName = trx.profiles?.full_name || "";
        if (adminName !== selectedAdmin) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
      }
      if (sortBy === "amount_desc") {
        return Number(b.amount) - Number(a.amount);
      }
      if (sortBy === "amount_asc") {
        return Number(a.amount) - Number(b.amount);
      }
      if (sortBy === "student_asc") {
        return (a.students?.name || "").localeCompare(b.students?.name || "");
      }
      return 0;
    });
  }, [transactions, searchQuery, periodFilter, startDate, endDate, selectedGrade, selectedBillType, selectedAdmin, sortBy]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setPeriodFilter("all");
    setStartDate("");
    setEndDate("");
    setSelectedGrade("all");
    setSelectedBillType("all");
    setSelectedAdmin("all");
    setSortBy("date_desc");
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalItems = filteredTransactions.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const totalPages = Math.ceil(totalItems / (effectivePageSize || 1)) || 1;
  const paginatedTransactions = useMemo(() => {
    if (pageSize === 0) return filteredTransactions;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(startIndex, startIndex + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // KPI Calculations based on filtered results
  const totalNominal = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [filteredTransactions]);

  const averageNominal = useMemo(() => {
    return totalItems > 0 ? Math.round(totalNominal / totalItems) : 0;
  }, [totalNominal, totalItems]);

  const handleDeleteTransaction = async (trx: any) => {
    if (confirm(`Apakah Anda yakin ingin menghapus transaksi ${trx.receipt_id} sebesar Rp ${Number(trx.amount).toLocaleString('id-ID')}? \n\nPERHATIAN: Tagihan untuk transaksi ini akan dikembalikan menjadi 'Belum Lunas'.`)) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const res = await fetch('/api/harian/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trx_id: trx.id, bill_id: trx.bill_id, userId: user?.id })
        });
        
        const data = await res.json();
        if (data.success) {
          setTransactions(prev => prev.filter(t => t.id !== trx.id));
          alert("Transaksi berhasil dihapus dan status tagihan dikembalikan menjadi Belum Lunas.");
        } else {
          alert("Gagal menghapus transaksi: " + data.error);
        }
      } catch (err: any) {
        alert("Terjadi kesalahan: " + err.message);
      }
    }
  };

  return (
    <div className="view-section space-y-6">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary tracking-tight">
                Jurnal Transaksi Harian
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
                Semua rekaman transaksi pembayaran tersimpan utuh dan dapat difilter dari awal hingga terkini.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            disabled={isLoading}
            className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-sm disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <span className={`material-symbols-outlined text-lg ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Transaksi</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {isLoading ? "..." : totalItems.toLocaleString('id-ID')}
              <span className="text-xs font-normal text-on-surface-variant ml-1">
                {transactions.length !== totalItems && `(dari ${transactions.length.toLocaleString('id-ID')})`}
              </span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Pemasukan</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {isLoading ? "..." : `Rp ${totalNominal.toLocaleString('id-ID')}`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Rata-rata Transaksi</p>
            <p className="text-2xl font-bold text-on-surface mt-1">
              {isLoading ? "..." : `Rp ${averageNominal.toLocaleString('id-ID')}`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">calculate</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm space-y-4">
        {/* Search Bar & Quick Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Universal Search Input */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Cari ID Transaksi, Nama Siswa, Admin, Jenis Tagihan, atau Bulan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded-full"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Quick Period Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-container-low border border-outline-variant rounded-xl">
            <button
              onClick={() => handlePeriodChange("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodFilter === "all"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white"
              }`}
            >
              Semua Waktu
            </button>
            <button
              onClick={() => handlePeriodChange("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodFilter === "today"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white"
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handlePeriodChange("this_month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodFilter === "this_month"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white"
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => handlePeriodChange("last_month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodFilter === "last_month"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white"
              }`}
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => handlePeriodChange("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodFilter === "custom"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white"
              }`}
            >
              Rentang Tanggal
            </button>
          </div>
        </div>

        {/* Detailed Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-outline-variant/60">
          {/* Custom Date Pickers */}
          {periodFilter === "custom" ? (
            <>
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                Jenjang Siswa
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="all">Semua Jenjang</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
              </select>
            </div>
          )}

          {periodFilter === "custom" && (
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                Jenjang Siswa
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="all">Semua Jenjang</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
              </select>
            </div>
          )}

          {/* Filter Jenis Tagihan */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
              Jenis Tagihan
            </label>
            <select
              value={selectedBillType}
              onChange={(e) => {
                setSelectedBillType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">Semua Jenis Tagihan</option>
              {availableBillTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filter Admin */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
              Kasir / Admin
            </label>
            <select
              value={selectedAdmin}
              onChange={(e) => {
                setSelectedAdmin(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">Semua Admin</option>
              {availableAdmins.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
              Urutkan Berdasarkan
            </label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="date_desc">Waktu Terbaru (Teratas)</option>
              <option value="date_asc">Waktu Terlama (Awal)</option>
              <option value="amount_desc">Nominal Tertinggi</option>
              <option value="amount_asc">Nominal Terendah</option>
              <option value="student_asc">Nama Siswa (A - Z)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-2 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold rounded-lg border border-outline-variant transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
        {/* Table Header Info */}
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">table_chart</span>
            <span className="font-bold text-primary text-sm">Daftar Transaksi</span>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              {totalItems.toLocaleString('id-ID')} Data
            </span>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span>Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-outline-variant rounded-md text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>Semua</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low/70 border-b border-outline-variant">
              <tr>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  WAKTU
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  ID TRANSAKSI
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  SISWA
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  TARGET BULAN
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  TIPE TAGIHAN
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  NOMINAL
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  ADMIN / KASIR
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0 text-center">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-on-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="font-medium text-sm">
                        Memuat data transaksi dari Supabase... {loadingProgress > 0 && `(${loadingProgress.toLocaleString('id-ID')} dimuat)`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((trx) => {
                  const paymentDate = new Date(trx.payment_date);
                  const formattedDate = paymentDate.toLocaleDateString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const formattedTime = paymentDate.toLocaleTimeString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={trx.id} className="hover:bg-surface-container-low/40 transition-colors">
                      {/* Waktu */}
                      <td className="px-5 py-3.5 text-xs text-on-surface-variant whitespace-nowrap" suppressHydrationWarning>
                        <div className="font-semibold text-on-surface">{formattedDate}</div>
                        <div className="text-[11px] text-on-surface-variant/80">{formattedTime} WIB</div>
                      </td>

                      {/* ID Transaksi */}
                      <td className="px-5 py-3.5 text-xs font-mono font-medium text-primary whitespace-nowrap">
                        {trx.receipt_id}
                      </td>

                      {/* Siswa */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-on-surface">
                            {trx.students?.name || 'Siswa Tidak Diketahui'}
                          </span>
                          {trx.students?.grade_level && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              trx.students.grade_level === 'SD' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {trx.students.grade_level}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Target Bulan */}
                      <td className="px-5 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                        {trx.student_bills?.bulan_tagihan || '-'}
                      </td>

                      {/* Tipe Tagihan */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-semibold border border-blue-100 inline-block">
                          {trx.jenis_tagihan || 'Tagihan'}
                        </span>
                      </td>

                      {/* Nominal */}
                      <td className="px-5 py-3.5 font-bold text-sm text-emerald-700 whitespace-nowrap">
                        Rp {Number(trx.amount).toLocaleString('id-ID')}
                      </td>

                      {/* Admin */}
                      <td className="px-5 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-outline">person</span>
                          <span>{trx.profiles?.full_name || 'Admin'}</span>
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {userRole === 'pimpinan' ? (
                          <button 
                            onClick={() => handleDeleteTransaction(trx)}
                            className="text-error hover:bg-error-container hover:text-red-800 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center" 
                            title="Hapus transaksi & kembalikan status tagihan"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant/70 italic cursor-help" title="Hanya pimpinan yang dapat membatalkan transaksi">
                            Akses Terbatas
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-outline">search_off</span>
                      <p className="font-semibold text-base text-on-surface">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs text-on-surface-variant">
                        Coba ubah kata kunci pencarian atau sesuaikan pilihan filter tanggal di atas.
                      </p>
                      {(searchQuery || periodFilter !== "all" || selectedGrade !== "all" || selectedBillType !== "all" || selectedAdmin !== "all") && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
                        >
                          Tampilkan Semua Data
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && pageSize > 0 && (
          <div className="p-4 bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
            <div>
              Menampilkan <span className="font-bold text-on-surface">{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</span> - <span className="font-bold text-on-surface">{Math.min(currentPage * pageSize, totalItems)}</span> dari <span className="font-bold text-on-surface">{totalItems.toLocaleString('id-ID')}</span> transaksi
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-outline-variant bg-white disabled:opacity-40 hover:bg-surface-container transition-colors"
                title="Halaman Pertama"
              >
                <span className="material-symbols-outlined text-sm">first_page</span>
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-outline-variant bg-white disabled:opacity-40 hover:bg-surface-container transition-colors"
                title="Halaman Sebelumnya"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>

              <div className="px-3 py-1 bg-white border border-outline-variant rounded-lg font-bold text-on-surface">
                Halaman {currentPage} dari {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-outline-variant bg-white disabled:opacity-40 hover:bg-surface-container transition-colors"
                title="Halaman Selanjutnya"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-outline-variant bg-white disabled:opacity-40 hover:bg-surface-container transition-colors"
                title="Halaman Terakhir"
              >
                <span className="material-symbols-outlined text-sm">last_page</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
