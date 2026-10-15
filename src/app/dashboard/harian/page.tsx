"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";

interface UnifiedTransaction {
  id: string;
  sourceType: "SPP" | "PSB" | "SERAGAM";
  sourceLabel: string;
  receipt_id: string;
  payment_date: string;
  amount: number;
  student_name: string;
  grade_level: string;
  class_name: string;
  category_label: string;
  payment_method: string;
  admin_name: string;
  bill_id?: string;
  notes?: string;
  raw: any;
}

export default function HarianPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  // Source Type Filter Tabs: 'ALL' | 'SPP' | 'PSB' | 'SERAGAM'
  const [selectedSource, setSelectedSource] = useState<"ALL" | "SPP" | "PSB" | "SERAGAM">("ALL");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "this_month" | "last_month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [selectedAdmin, setSelectedAdmin] = useState("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "student_asc">("date_desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Edit Transaction State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTrx, setEditingTrx] = useState<UnifiedTransaction | null>(null);
  const [editPaymentMethod, setEditPaymentMethod] = useState<"TUNAI" | "TRANSFER">("TUNAI");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/harian");
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setTransactions(result.data);
      } else {
        console.error("Gagal memuat transaksi:", result.error);
      }
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
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setUserRole(profile?.role || user.user_metadata?.role || "admin");
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchUserRole();
  }, []);

  // Quick period change
  const handlePeriodChange = (type: "all" | "today" | "this_month" | "last_month" | "custom") => {
    setPeriodFilter(type);
    setCurrentPage(1);

    const formatJakartaDate = (d: Date) => {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    };

    const now = new Date();
    const todayJakarta = formatJakartaDate(now);
    const [yStr, mStr] = todayJakarta.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1; // 0-indexed month

    if (type === "today") {
      setStartDate(todayJakarta);
      setEndDate(todayJakarta);
    } else if (type === "this_month") {
      const start = `${yStr}-${mStr}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
      setStartDate(start);
      setEndDate(end);
    } else if (type === "last_month") {
      const lastMonthDate = new Date(y, m - 1, 1);
      const ly = lastMonthDate.getFullYear();
      const lm = lastMonthDate.getMonth() + 1;
      const lyStr = String(ly);
      const lmStr = String(lm).padStart(2, "0");
      const start = `${lyStr}-${lmStr}-01`;
      const lastDay = new Date(ly, lm, 0).getDate();
      const end = `${lyStr}-${lmStr}-${String(lastDay).padStart(2, "0")}`;
      setStartDate(start);
      setEndDate(end);
    } else if (type === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Distinct admins for dropdown (exclude generic 'admin' and 'kasir toko')
  const availableAdmins = useMemo(() => {
    const admins = new Set<string>();
    transactions.forEach((t) => {
      const name = (t.admin_name || "").trim();
      const lower = name.toLowerCase();
      if (name && lower !== "admin" && lower !== "kasir toko") {
        admins.add(name);
      }
    });
    return Array.from(admins).sort();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((trx) => {
        // 1. Source Filter (Tab)
        if (selectedSource !== "ALL" && trx.sourceType !== selectedSource) {
          return false;
        }

        // 2. Search Query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const receipt = (trx.receipt_id || "").toLowerCase();
          const student = (trx.student_name || "").toLowerCase();
          const admin = (trx.admin_name || "").toLowerCase();
          const category = (trx.category_label || "").toLowerCase();
          const notes = (trx.notes || "").toLowerCase();

          const match =
            receipt.includes(query) ||
            student.includes(query) ||
            admin.includes(query) ||
            category.includes(query) ||
            notes.includes(query);
          if (!match) return false;
        }

        // 3. Date Filtering
        if (periodFilter !== "all") {
          const trxDate = (() => {
            if (!trx.payment_date) return "";
            try {
              const d = new Date(trx.payment_date);
              if (isNaN(d.getTime())) return trx.payment_date.slice(0, 10);
              return new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Jakarta",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(d);
            } catch {
              return trx.payment_date.slice(0, 10);
            }
          })();
          if (startDate && trxDate < startDate) return false;
          if (endDate && trxDate > endDate) return false;
        }

        // 4. Jenjang Filter
        if (selectedGrade !== "all") {
          if ((trx.grade_level || "").toUpperCase() !== selectedGrade.toUpperCase()) return false;
        }

        // 5. Payment Method Filter
        if (selectedPaymentMethod !== "all") {
          if (trx.payment_method !== selectedPaymentMethod) return false;
        }

        // 6. Admin Filter
        if (selectedAdmin !== "all") {
          if (trx.admin_name !== selectedAdmin) return false;
        }

        return true;
      })
      .sort((a, b) => {
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
          return (a.student_name || "").localeCompare(b.student_name || "");
        }
        return 0;
      });
  }, [
    transactions,
    selectedSource,
    searchQuery,
    periodFilter,
    startDate,
    endDate,
    selectedGrade,
    selectedPaymentMethod,
    selectedAdmin,
    sortBy,
  ]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedSource("ALL");
    setSearchQuery("");
    setPeriodFilter("all");
    setStartDate("");
    setEndDate("");
    setSelectedGrade("all");
    setSelectedPaymentMethod("all");
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

  // Summary Metrics based on filtered list
  const { totalNominal, sppSum, psbSum, seragamSum, cashSum, transferSum } = useMemo(() => {
    let total = 0;
    let spp = 0;
    let psb = 0;
    let srg = 0;
    let cash = 0;
    let transfer = 0;

    filteredTransactions.forEach((t) => {
      total += t.amount;
      if (t.sourceType === "SPP") spp += t.amount;
      else if (t.sourceType === "PSB") psb += t.amount;
      else if (t.sourceType === "SERAGAM") srg += t.amount;

      if (t.payment_method === "TRANSFER") transfer += t.amount;
      else cash += t.amount;
    });

    return {
      totalNominal: total,
      sppSum: spp,
      psbSum: psb,
      seragamSum: srg,
      cashSum: cash,
      transferSum: transfer,
    };
  }, [filteredTransactions]);

  const handleDeleteTransaction = async (trx: UnifiedTransaction) => {
    if (trx.sourceType !== "SPP") {
      alert("Pembatalan transaksi untuk kategori ini silakan dilakukan langsung di modul terkait (PSB / Penjualan Seragam).");
      return;
    }

    if (
      confirm(
        `Apakah Anda yakin ingin menghapus transaksi ${trx.receipt_id} sebesar Rp ${Number(
          trx.amount
        ).toLocaleString(
          "id-ID"
        )}? \n\nPERHATIAN: Tagihan untuk transaksi ini akan dikembalikan menjadi 'Belum Lunas'.`
      )
    ) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const res = await fetch("/api/harian/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trx_id: trx.id, bill_id: trx.bill_id, userId: user?.id }),
        });

        const data = await res.json();
        if (data.success) {
          setTransactions((prev) => prev.filter((t) => t.id !== trx.id));
          alert("Transaksi berhasil dihapus dan status tagihan dikembalikan menjadi Belum Lunas.");
        } else {
          alert("Gagal menghapus transaksi: " + data.error);
        }
      } catch (err: any) {
        alert("Terjadi kesalahan: " + err.message);
      }
    }
  };

  const toLocalDatetimeInput = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const handleOpenEditModal = (trx: UnifiedTransaction) => {
    setEditingTrx(trx);
    setEditPaymentMethod((trx.payment_method?.toUpperCase() === "TRANSFER" ? "TRANSFER" : "TUNAI") as "TUNAI" | "TRANSFER");
    setEditPaymentDate(toLocalDatetimeInput(trx.payment_date));
    setEditNotes(trx.notes || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrx) return;

    setIsSavingEdit(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch("/api/harian/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trx_id: editingTrx.id,
          sourceType: editingTrx.sourceType,
          payment_method: editPaymentMethod,
          payment_date: editPaymentDate ? new Date(editPaymentDate).toISOString() : undefined,
          notes: editNotes,
          userId: user?.id,
        }),
      });

      const result = await res.json();
      if (result.success) {
        alert("Transaksi berhasil diperbarui.");
        setIsEditModalOpen(false);
        setEditingTrx(null);
        fetchTransactions();
      } else {
        alert("Gagal memperbarui transaksi: " + (result.error || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsSavingEdit(false);
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
                Jurnal Transaksi Harian Terpadu
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
                Rekapitulasi terpadu seluruh kas masuk: SPP Rutin, Cicilan PSB (Uang Masuk), dan Penjualan Seragam.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            disabled={isLoading}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant rounded-xl flex items-center gap-2 text-sm font-medium transition-all shadow-sm disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <span className={`material-symbols-outlined text-lg ${isLoading ? "animate-spin" : ""}`}>refresh</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter: Kategori Transaksi */}
      <div className="flex border-b border-outline-variant gap-4 overflow-x-auto">
        <button
          onClick={() => {
            setSelectedSource("ALL");
            setCurrentPage(1);
          }}
          className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            selectedSource === "ALL"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          Semua Pemasukan Terpadu
          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {transactions.length}
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedSource("SPP");
            setCurrentPage(1);
          }}
          className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            selectedSource === "SPP"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">payments</span>
          SPP &amp; Tagihan Siswa
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {transactions.filter((t) => t.sourceType === "SPP").length}
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedSource("PSB");
            setCurrentPage(1);
          }}
          className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            selectedSource === "PSB"
              ? "border-amber-600 text-amber-600"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          Uang Masuk PSB
          <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {transactions.filter((t) => t.sourceType === "PSB").length}
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedSource("SERAGAM");
            setCurrentPage(1);
          }}
          className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            selectedSource === "SERAGAM"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">checkroom</span>
          Penjualan Seragam
          <span className="bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {transactions.filter((t) => t.sourceType === "SERAGAM").length}
          </span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      {userRole === "pimpinan" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Kas Masuk Keseluruhan */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Total Kas Masuk Terpadu</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {isLoading ? "..." : `Rp ${totalNominal.toLocaleString("id-ID")}`}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Tunai: <span className="font-bold text-green-700">Rp {cashSum.toLocaleString("id-ID")}</span> | TF:{" "}
                <span className="font-bold text-blue-700">Rp {transferSum.toLocaleString("id-ID")}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">point_of_sale</span>
            </div>
          </div>

          {/* SPP & Tagihan Siswa */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Penerimaan SPP &amp; Tagihan</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {isLoading ? "..." : `Rp ${sppSum.toLocaleString("id-ID")}`}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {filteredTransactions.filter((t) => t.sourceType === "SPP").length} transaksi
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
          </div>

          {/* Uang Masuk PSB */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Cicilan Uang Masuk (PSB)</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {isLoading ? "..." : `Rp ${psbSum.toLocaleString("id-ID")}`}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {filteredTransactions.filter((t) => t.sourceType === "PSB").length} transaksi
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">how_to_reg</span>
            </div>
          </div>

          {/* Penjualan Seragam */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-teal-800 uppercase tracking-wider">Penjualan Seragam</p>
              <p className="text-2xl font-bold text-teal-700 mt-1">
                {isLoading ? "..." : `Rp ${seragamSum.toLocaleString("id-ID")}`}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {filteredTransactions.filter((t) => t.sourceType === "SERAGAM").length} transaksi
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">checkroom</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Transaksi Terpadu */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Total Transaksi Kas Masuk</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {isLoading ? "..." : `${filteredTransactions.length} Transaksi`}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Tunai: <span className="font-bold text-green-700">{filteredTransactions.filter(t => t.payment_method === "TUNAI").length} trx</span> | TF:{" "}
                <span className="font-bold text-blue-700">{filteredTransactions.filter(t => t.payment_method === "TRANSFER").length} trx</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
          </div>

          {/* SPP & Tagihan Siswa */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Transaksi SPP &amp; Tagihan</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {filteredTransactions.filter((t) => t.sourceType === "SPP").length} Transaksi
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Pembayaran SPP &amp; tagihan rutin</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
          </div>

          {/* Uang Masuk PSB */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Transaksi Cicilan PSB</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {filteredTransactions.filter((t) => t.sourceType === "PSB").length} Transaksi
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Cicilan uang masuk siswa baru</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">how_to_reg</span>
            </div>
          </div>

          {/* Penjualan Seragam */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-teal-800 uppercase tracking-wider">Transaksi Penjualan Seragam</p>
              <p className="text-2xl font-bold text-teal-700 mt-1">
                {filteredTransactions.filter((t) => t.sourceType === "SERAGAM").length} Transaksi
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Pembelian seragam &amp; atribut</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">checkroom</span>
            </div>
          </div>
        </div>
      )}

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
              placeholder="Cari No. Resi, Nama Siswa/Calon Siswa, Kasir, atau Uraian..."
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
          {periodFilter === "custom" && (
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
          )}

          {/* Jenjang Siswa */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
              Jenjang
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
              <option value="SMA">SMA</option>
            </select>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
              Metode Bayar
            </label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => {
                setSelectedPaymentMethod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-outline-variant rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">Semua Metode</option>
              <option value="TUNAI">TUNAI</option>
              <option value="TRANSFER">TRANSFER BANK</option>
            </select>
          </div>

          {/* Kasir / Admin */}
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
              {availableAdmins.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
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
            <span className="font-bold text-primary text-sm">Daftar Transaksi Kas Masuk</span>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              {totalItems.toLocaleString("id-ID")} Transaksi
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
                  TINGKAT
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  NO. RESI / KWITANSI
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  SISWA / CALON SISWA
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  URAIAN PEMBAYARAN
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  METODE
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
                  <td colSpan={9} className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="font-medium text-sm">Memuat rekapan seluruh transaksi kas masuk...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((trx) => {
                  const paymentDate = new Date(trx.payment_date);
                  const isValidDate = !isNaN(paymentDate.getTime());
                  const formattedDate = isValidDate
                    ? paymentDate.toLocaleDateString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : trx.payment_date || "-";
                  const formattedTime = isValidDate
                    ? paymentDate
                        .toLocaleTimeString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                        .replace(".", ":")
                    : "";

                  return (
                    <tr key={trx.id} className="hover:bg-surface-container-low/40 transition-colors">
                      {/* Waktu */}
                      <td className="px-5 py-3.5 text-xs text-on-surface-variant whitespace-nowrap" suppressHydrationWarning>
                        <div className="font-semibold text-on-surface">{formattedDate}</div>
                        {formattedTime && (
                          <div className="text-[11px] text-on-surface-variant/80 font-medium flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[13px] text-primary">schedule</span>
                            <span>{formattedTime} WIB</span>
                          </div>
                        )}
                      </td>

                      {/* Tingkat Siswa Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {trx.grade_level?.toUpperCase() === "SD" ? (
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] font-bold border border-blue-200">
                            SD
                          </span>
                        ) : trx.grade_level?.toUpperCase() === "SMP" ? (
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded text-[11px] font-bold border border-purple-200">
                            SMP
                          </span>
                        ) : trx.grade_level?.toUpperCase() === "SMA" ? (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-bold border border-emerald-200">
                            SMA
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-bold border border-gray-200">
                            {trx.grade_level || "-"}
                          </span>
                        )}
                      </td>

                      {/* No. Resi */}
                      <td className="px-5 py-3.5 text-xs font-mono font-medium text-primary whitespace-nowrap">
                        {trx.receipt_id}
                      </td>

                      {/* Siswa */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-on-surface">{trx.student_name}</span>
                          <span className="text-xs text-on-surface-variant">
                            {trx.class_name}
                          </span>
                        </div>
                      </td>

                      {/* Uraian */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-xs text-on-surface">{trx.category_label}</div>
                        {trx.notes && trx.notes !== trx.category_label && (
                          <div className="text-[11px] text-on-surface-variant italic truncate max-w-xs">
                            {trx.notes}
                          </div>
                        )}
                      </td>

                      {/* Metode */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            trx.payment_method === "TRANSFER"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {trx.payment_method || "TUNAI"}
                        </span>
                      </td>

                      {/* Nominal */}
                      <td className="px-5 py-3.5 font-bold text-sm text-emerald-700 whitespace-nowrap">
                        Rp {Number(trx.amount).toLocaleString("id-ID")}
                      </td>

                      {/* Admin */}
                      <td className="px-5 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                        {trx.admin_name}
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(trx)}
                            className="text-primary hover:bg-primary/10 hover:text-blue-700 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                            title="Edit transaksi (metode pembayaran, tanggal, dll)"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          {trx.sourceType === "SPP" && userRole === "pimpinan" && (
                            <button
                              onClick={() => handleDeleteTransaction(trx)}
                              className="text-error hover:bg-error-container hover:text-red-800 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                              title="Hapus transaksi & kembalikan status tagihan"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-outline">search_off</span>
                      <p className="font-semibold text-base text-on-surface">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs text-on-surface-variant">
                        Coba ubah kata kunci pencarian atau sesuaikan pilihan filter tanggal di atas.
                      </p>
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
              Menampilkan{" "}
              <span className="font-bold text-on-surface">
                {Math.min((currentPage - 1) * pageSize + 1, totalItems)}
              </span>{" "}
              -{" "}
              <span className="font-bold text-on-surface">{Math.min(currentPage * pageSize, totalItems)}</span> dari{" "}
              <span className="font-bold text-on-surface">{totalItems.toLocaleString("id-ID")}</span> transaksi
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
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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

      {/* Edit Transaction Modal */}
      {isEditModalOpen && editingTrx && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-outline-variant overflow-hidden flex flex-col my-auto">
            <div className="flex justify-between items-center p-5 border-b border-outline-variant bg-surface-container-lowest">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">edit_note</span>
                </div>
                <div>
                  <h3 className="font-title-lg text-title-lg text-primary">Edit Transaksi</h3>
                  <p className="text-xs text-on-surface-variant">{editingTrx.receipt_id}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTrx(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Transaction Summary Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Siswa:</span>
                  <span className="font-bold text-slate-800">{editingTrx.student_name} ({editingTrx.class_name})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tagihan / Jenis:</span>
                  <span className="font-semibold text-slate-700">{editingTrx.category_label}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Nominal:</span>
                  <span className="font-bold text-sm text-emerald-700">Rp {Number(editingTrx.amount).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Metode Pembayaran *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod("TUNAI")}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                      editPaymentMethod === "TUNAI"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300"
                        : "bg-surface border-outline-variant text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">payments</span>
                    TUNAI (CASH)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod("TRANSFER")}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                      editPaymentMethod === "TRANSFER"
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                        : "bg-surface border-outline-variant text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">account_balance</span>
                    TRANSFER
                  </button>
                </div>
              </div>

              {/* Tanggal & Waktu Transaksi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tanggal &amp; Waktu Transaksi
                </label>
                <input
                  type="datetime-local"
                  value={editPaymentDate}
                  onChange={(e) => setEditPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">Sesuaikan tanggal/jam jika ada kesalahan pencatatan waktu.</p>
              </div>

              {/* Catatan (if PSB or available) */}
              {editingTrx.sourceType === "PSB" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Kwitansi
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Catatan kwitansi PSB..."
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTrx(null);
                  }}
                  className="flex-1 py-2.5 border border-outline-variant text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Simpan Perubahan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
