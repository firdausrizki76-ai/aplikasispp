"use client";

import { createClient } from "@/utils/supabase/client";
import { formatWhatsAppNumber } from "@/utils/phone";
import { getDefaultPPDBAcademicYear, getDynamicAcademicYears } from "@/utils/academicYear";
import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

interface Installment {
  id: string;
  receipt_no: string;
  installment_step: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

interface PSBCandidate {
  id: string;
  registration_no: string;
  full_name: string;
  gender: "L" | "P" | null;
  pob: string | null;
  dob: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  target_grade: "SD" | "SMP";
  academic_year: string;
  base_amount: number;
  discount_type: string | null;
  discount_amount: number;
  discount_notes: string | null;
  total_amount: number;
  total_paid: number;
  remaining_balance: number;
  status: "BELUM_BAYAR" | "MENCICIL" | "LUNAS" | "TERDAFTAR_KELAS";
  synced_student_id: string | null;
  created_at: string;
  synced_student?: {
    id: string;
    name: string;
    class_name: string | null;
    classes?: { class_name: string } | null;
  } | null;
  installments?: Installment[];
}

interface ClassOption {
  id: string;
  class_name: string;
  grade_level: string;
}

const DISCOUNT_PRESETS = [
  { label: "Tanpa Diskon", amount: 0 },
  { label: "Diskon Anak Ke-2 (Rp 300.000)", amount: 300000 },
  { label: "Diskon Anak Ke-3 / Seterusnya (Rp 500.000)", amount: 500000 },
  { label: "Diskon Anak Yatim / Piatu (Rp 1.000.000)", amount: 1000000 },
  { label: "Lanjutan TK Taruna Islam ke SD (Rp 500.000)", amount: 500000 },
  { label: "Lanjutan SD Taruna Islam ke SMP (Rp 500.000)", amount: 500000 },
  { label: "Keringanan Keluarga Kurang Mampu (Rp 750.000)", amount: 750000 },
  { label: "Diskon Khusus Pimpinan Yayasan (Kustom)", amount: 0 },
  { label: "Lainnya (Kustom)", amount: 0 },
];

export default function PSBPage() {
  const supabase = createClient();
  const [userRole, setUserRole] = useState("admin");
  const [userId, setUserId] = useState<string | null>(null);

  const defaultAcademicYear = useMemo(() => getDefaultPPDBAcademicYear(), []);

  // Candidates & State
  const [candidates, setCandidates] = useState<PSBCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [filterYear, setFilterYear] = useState<string>(defaultAcademicYear);
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic Academic Year Options (auto-advancing + preserves DB history)
  const academicYearOptions = useMemo(() => {
    return getDynamicAcademicYears(candidates.map((c) => c.academic_year));
  }, [candidates]);

  // Summary Metrics
  const [summary, setSummary] = useState({
    totalCandidates: 0,
    totalTarget: 0,
    totalPaid: 0,
    totalRemaining: 0,
    countLunas: 0,
    countMencicil: 0,
    countBelumBayar: 0,
    countTerdaftarKelas: 0,
  });

  // Modal 1: Register Candidate
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "",
    gender: "L" as "L" | "P",
    pob: "",
    dob: "",
    parent_name: "",
    parent_phone: "",
    target_grade: "SD" as "SD" | "SMP",
    academic_year: defaultAcademicYear,
    base_amount: 6900000,
    discount_type: "Tanpa Diskon",
    discount_amount: 0,
    discount_notes: "",
    payInitial: false,
    initial_payment: 1000000,
    payment_method: "TUNAI",
    notes: "",
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Modal 2: Pay Installment
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<PSBCandidate | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<string>("TUNAI");
  const [payNotes, setPayNotes] = useState<string>("");
  const [submittingPay, setSubmittingPay] = useState(false);

  // Modal 3: Sync Candidate to Class
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncCandidate, setSyncCandidate] = useState<PSBCandidate | null>(null);
  const [syncClassId, setSyncClassId] = useState<string>("");
  const [syncNis, setSyncNis] = useState<string>("");
  const [submittingSync, setSubmittingSync] = useState(false);

  // Modal 4: Receipt View / Print
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    candidate: PSBCandidate;
    installment: Installment;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role) setUserRole(profile.role);
      }
    };
    initUser();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from("classes")
      .select("id, class_name, grade_level")
      .order("class_name", { ascending: true });
    if (data) setClassesList(data);
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear) params.append("academic_year", filterYear);
      if (filterGrade) params.append("target_grade", filterGrade);
      if (filterStatus) params.append("status", filterStatus);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/psb/candidates?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setCandidates(result.data || []);
        if (result.summary) {
          setSummary(result.summary);
        }
      } else {
        alert("Gagal memuat data calon siswa: " + (result.error || ""));
      }
    } catch (err: any) {
      console.error("Fetch candidates error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filterYear, filterGrade, filterStatus]);

  // Handle Search Debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchCandidates();
    }, 400);
  };

  // Preset discount selection handler
  const handleDiscountTypeChange = (type: string) => {
    const preset = DISCOUNT_PRESETS.find((p) => p.label === type);
    setAddForm((prev) => ({
      ...prev,
      discount_type: type,
      discount_amount: preset ? preset.amount : prev.discount_amount,
    }));
  };

  // Submit Register
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.full_name.trim()) {
      alert("Nama calon siswa wajib diisi!");
      return;
    }
    setSubmittingAdd(true);
    try {
      const res = await fetch("/api/psb/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          initial_payment: addForm.payInitial ? addForm.initial_payment : 0,
          userId,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        alert(`Calon siswa berhasil didaftarkan!\nNo. Registrasi: ${resData.candidate.registration_no}`);
        setIsAddModalOpen(false);
        // Reset form
        setAddForm({
          full_name: "",
          gender: "L",
          pob: "",
          dob: "",
          parent_name: "",
          parent_phone: "",
          target_grade: "SD",
          academic_year: defaultAcademicYear,
          base_amount: 6900000,
          discount_type: "Tanpa Diskon",
          discount_amount: 0,
          discount_notes: "",
          payInitial: false,
          initial_payment: 1000000,
          payment_method: "TUNAI",
          notes: "",
        });
        fetchCandidates();
      } else {
        alert("Gagal mendaftar: " + (resData.error || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Pay Modal
  const openPayModal = (candidate: PSBCandidate) => {
    setSelectedCandidate(candidate);
    const suggested = Math.min(candidate.remaining_balance, 1000000);
    setPayAmount(candidate.remaining_balance > 0 ? (suggested > 0 ? suggested : candidate.remaining_balance) : 0);
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("TUNAI");
    setPayNotes("");
    setIsPayModalOpen(true);
  };

  // Submit Payment
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || payAmount <= 0) {
      alert("Masukkan nominal pembayaran cicilan yang valid.");
      return;
    }

    if (payAmount > selectedCandidate.remaining_balance) {
      if (
        !confirm(
          `Nominal pembayaran (Rp ${payAmount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${selectedCandidate.remaining_balance.toLocaleString(
            "id-ID"
          )}). Lanjutkan?`
        )
      ) {
        return;
      }
    }

    setSubmittingPay(true);
    try {
      const res = await fetch("/api/psb/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedCandidate.id,
          amount: payAmount,
          paymentDate: payDate,
          paymentMethod: payMethod,
          notes: payNotes,
          userId,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        const latestInstallment: Installment = {
          id: resData.installment_id || Date.now().toString(),
          receipt_no: resData.receiptNo,
          installment_step: resData.installmentStep,
          amount: payAmount,
          payment_date: payDate,
          payment_method: payMethod,
          notes: payNotes,
          created_at: new Date().toISOString(),
        };

        const updatedCandidate: PSBCandidate = {
          ...selectedCandidate,
          total_paid: resData.totalPaid,
          remaining_balance: resData.remainingBalance,
          status: resData.status,
          installments: [...(selectedCandidate.installments || []), latestInstallment],
        };

        setIsPayModalOpen(false);
        fetchCandidates();

        // Prompt to open Receipt & Send WA
        if (
          confirm(
            `Pembayaran cicilan ke-${resData.installmentStep} berhasil dicatat!\nNo. Kwitansi: ${resData.receiptNo}\n\nBuka Kwitansi sekarang?`
          )
        ) {
          openReceiptModal(updatedCandidate, latestInstallment);
        }
      } else {
        alert("Gagal mencatat pembayaran: " + (resData.error || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setSubmittingPay(false);
    }
  };

  // Open Sync Modal
  const openSyncModal = (candidate: PSBCandidate) => {
    setSyncCandidate(candidate);
    // Find default class according to candidate's grade level
    const defaultClass = classesList.find((c) => c.grade_level === candidate.target_grade);
    setSyncClassId(defaultClass?.id || "");
    setSyncNis(candidate.registration_no);
    setIsSyncModalOpen(true);
  };

  // Submit Sync
  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncCandidate || !syncClassId) {
      alert("Pilih kelas untuk penempatan siswa!");
      return;
    }

    if (!confirm(`Tempatkan calon siswa "${syncCandidate.full_name}" ke kelas yang dipilih? Siswa akan otomatis aktif di T.A. baru.`)) {
      return;
    }

    setSubmittingSync(true);
    try {
      const res = await fetch("/api/psb/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: syncCandidate.id,
          classId: syncClassId,
          nis: syncNis,
          userId,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        alert(`Berhasil! ${resData.studentName} kini telah terdaftar di kelas ${resData.className}.`);
        setIsSyncModalOpen(false);
        setSyncCandidate(null);
        fetchCandidates();
      } else {
        alert("Gagal sinkronisasi: " + (resData.error || ""));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setSubmittingSync(false);
    }
  };

  // Open Receipt Modal
  const openReceiptModal = (candidate: PSBCandidate, installment: Installment) => {
    setReceiptData({ candidate, installment });
    setIsReceiptModalOpen(true);
  };

  // WhatsApp Notification Helper
  const sendWhatsAppNotification = (candidate: PSBCandidate, installment?: Installment) => {
    const phone = formatWhatsAppNumber(candidate.parent_phone);
    if (!phone) {
      alert("Nomor WhatsApp orang tua belum diisi atau tidak valid.");
      return;
    }

    let message = "";
    if (installment) {
      // Payment receipt message
      message = `*BUKTI PEMBAYARAN UANG MASUK (PSB)*
*SD-SMP TARUNA ISLAM PEKANBARU*
----------------------------------------
No. Kwitansi : *${installment.receipt_no}*
T.A.         : *${candidate.academic_year}*
Nama Siswa   : *${candidate.full_name}*
Jenjang      : *${candidate.target_grade}*
Pembayaran   : *Cicilan Ke-${installment.installment_step}*
Tanggal      : *${new Date(installment.payment_date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}*
Metode       : *${installment.payment_method}*
Nominal      : *Rp ${Number(installment.amount).toLocaleString("id-ID")}*
----------------------------------------
*RINCIAN BIAYA PSB:*
Total Biaya  : Rp ${Number(candidate.total_amount).toLocaleString("id-ID")}
Total Masuk  : Rp ${Number(candidate.total_paid).toLocaleString("id-ID")}
*Sisa Tagihan: Rp ${Number(candidate.remaining_balance).toLocaleString("id-ID")}*
Status       : *${candidate.status === "LUNAS" || candidate.remaining_balance <= 0 ? "LUNAS ✅" : "BELUM LUNAS (Mencicil) ⏳"}*
----------------------------------------
Alhamdulillah, pembayaran telah kami terima dengan baik. Terima kasih atas kepercayaan Ayah/Bunda kepada SD-SMP Taruna Islam Pekanbaru.

_Wassalamu'alaikum Warahmatullahi Wabarakatuh._`;
    } else {
      // Reminder message
      message = `*PEMBERITAHUAN TUNGGAKAN UANG MASUK (PSB)*
*SD-SMP TARUNA ISLAM PEKANBARU*
----------------------------------------
No. Registrasi : *${candidate.registration_no}*
T.A.           : *${candidate.academic_year}*
Nama Siswa     : *${candidate.full_name}*
Jenjang        : *${candidate.target_grade}*
Total Biaya    : Rp ${Number(candidate.total_amount).toLocaleString("id-ID")}
Total Dibayar  : Rp ${Number(candidate.total_paid).toLocaleString("id-ID")}
*Sisa Tagihan  : Rp ${Number(candidate.remaining_balance).toLocaleString("id-ID")}*
----------------------------------------
Assalamu'alaikum Warahmatullahi Wabarakatuh.
Yth. Ayah/Bunda dari *${candidate.full_name}*, kami menginformasikan sisa kewajiban uang masuk (PSB) yang masih dapat diangsur hingga batas waktu 1 semester.

Pembayaran dapat dilakukan melalui kasir sekolah secara tunai atau transfer rekening yayasan. Apabila ada pertanyaan, silakan menghubungi kami. Terima kasih. 🙏✨`;
    }

    const waUrl = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  // Delete Candidate
  const handleDeleteCandidate = async (candidate: PSBCandidate) => {
    if (
      !confirm(
        `PERINGATAN: Apakah Anda yakin ingin menghapus data calon siswa "${candidate.full_name}" (${candidate.registration_no}) beserta seluruh riwayat cicilannya?\n\nTindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/psb/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Data calon siswa berhasil dihapus.");
        fetchCandidates();
      } else {
        alert("Gagal menghapus: " + (data.error || ""));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    }
  };

  return (
    <>
      <div className="view-section space-y-6">
        {/* Header & Main Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">how_to_reg</span>
              <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
                Penerimaan Siswa Baru (PSB) &amp; Uang Masuk
              </h2>
            </div>
            <p className="font-body-md text-on-surface-variant mt-1">
              Kelola pendaftaran PPDB (uang masuk), skema potongan harga/diskon, sistem cicilan uang masuk, dan sinkronisasi penempatan kelas.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary-container text-on-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Daftar Calon Siswa Baru
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">Total Calon Siswa</p>
              <h3 className="text-2xl font-bold text-on-surface mt-1">{summary.totalCandidates} Siswa</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Lunas: <span className="text-green-600 font-bold">{summary.countLunas}</span> | Masuk Kelas:{" "}
                <span className="text-blue-600 font-bold">{summary.countTerdaftarKelas}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">groups</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">Target Uang Masuk (Nett)</p>
              <h3 className="text-2xl font-bold text-primary mt-1">
                Rp {summary.totalTarget.toLocaleString("id-ID")}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">Setelah dikurangi diskon</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">calculate</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-green-700 tracking-wider">Uang Masuk Diterima</p>
              <h3 className="text-2xl font-bold text-green-700 mt-1">
                Rp {summary.totalPaid.toLocaleString("id-ID")}
              </h3>
              <p className="text-xs text-green-600 mt-1">
                Tercapai:{" "}
                <span className="font-bold">
                  {summary.totalTarget > 0 ? Math.round((summary.totalPaid / summary.totalTarget) * 100) : 0}%
                </span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-amber-700 tracking-wider">Sisa Tunggakan Cicilan</p>
              <h3 className="text-2xl font-bold text-amber-700 mt-1">
                Rp {summary.totalRemaining.toLocaleString("id-ID")}
              </h3>
              <p className="text-xs text-amber-600 mt-1">
                Sedang Mencicil: <span className="font-bold">{summary.countMencicil}</span> siswa
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Tahun Ajaran */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase">T.A.:</span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Semua Tahun</option>
                {academicYearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} {yr === defaultAcademicYear ? "(PPDB Baru)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Jenjang */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase">Jenjang:</span>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Semua Jenjang</option>
                <option value="SD">SD Taruna Islam</option>
                <option value="SMP">SMP Taruna Islam</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Semua Status</option>
                <option value="BELUM_BAYAR">Belum Bayar</option>
                <option value="MENCICIL">Sedang Mencicil</option>
                <option value="LUNAS">Lunas (Belum Kelas)</option>
                <option value="TERDAFTAR_KELAS">Terdaftar di Kelas</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari nama / no. reg / ortu..."
              className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Candidate Table */}
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs">
                    No. Registrasi / Tanggal
                  </th>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs">
                    Calon Siswa &amp; Kontak Ortu
                  </th>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs">
                    Jenjang
                  </th>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs">
                    Skema Biaya &amp; Diskon
                  </th>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs">
                    Riwayat Cicilan
                  </th>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs">
                    Status
                  </th>
                  <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                        Memuat data calon siswa PSB...
                      </div>
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl text-outline mb-2 block">person_off</span>
                      Belum ada data calon siswa untuk filter yang dipilih. Silakan klik tombol{" "}
                      <strong>Daftar Calon Siswa Baru</strong> untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => {
                    const pct = c.total_amount > 0 ? Math.min(100, Math.round((c.total_paid / c.total_amount) * 100)) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-surface-container-low/40 transition-colors">
                        {/* Reg & Date */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-bold text-primary text-sm tracking-wide">{c.registration_no}</div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            {new Date(c.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                            T.A. {c.academic_year}
                          </span>
                        </td>

                        {/* Student Name & Parent Phone */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-bold text-on-surface text-base">{c.full_name}</div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            {c.gender === "L" ? "Laki-laki" : c.gender === "P" ? "Perempuan" : "-"}
                            {c.dob && ` • Lahir: ${new Date(c.dob).toLocaleDateString("id-ID")}`}
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium text-on-surface-variant">
                              Ortu: {c.parent_name || "-"}
                            </span>
                            {c.parent_phone && (
                              <button
                                onClick={() => sendWhatsAppNotification(c)}
                                title="Kirim Pengingat / Rincian WA"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-0.5 rounded-full transition-all"
                              >
                                <span className="material-symbols-outlined text-[13px]">chat</span>
                                {c.parent_phone}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Grade Level */}
                        <td className="px-5 py-4 align-top">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                              c.target_grade === "SD"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-purple-100 text-purple-800 border border-purple-200"
                            }`}
                          >
                            {c.target_grade}
                          </span>
                        </td>

                        {/* Fees & Discounts */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-bold text-on-surface">
                            Rp {Number(c.total_amount).toLocaleString("id-ID")}
                          </div>
                          {c.discount_amount > 0 ? (
                            <div className="text-xs text-emerald-700 mt-1 flex flex-col">
                              <span className="line-through text-on-surface-variant opacity-60">
                                Asli: Rp {Number(c.base_amount).toLocaleString("id-ID")}
                              </span>
                              <span className="font-semibold">
                                Diskon: -Rp {Number(c.discount_amount).toLocaleString("id-ID")} ({c.discount_type})
                              </span>
                              {c.discount_notes && (
                                <span className="italic text-[11px] text-on-surface-variant opacity-80">
                                  "{c.discount_notes}"
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-on-surface-variant mt-0.5">Tanpa Diskon</div>
                          )}
                        </td>

                        {/* Installments & Balance */}
                        <td className="px-5 py-4 align-top min-w-[200px]">
                          <div className="flex justify-between items-baseline text-xs mb-1">
                            <span className="font-bold text-green-700">
                              Terbayar: Rp {Number(c.total_paid).toLocaleString("id-ID")}
                            </span>
                            <span className="font-bold text-on-surface-variant">{pct}%</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-1.5">
                            <div
                              className={`h-full transition-all duration-300 ${
                                pct >= 100 ? "bg-green-600" : pct > 0 ? "bg-amber-500" : "bg-transparent"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="text-xs">
                            Sisa:{" "}
                            <span
                              className={`font-bold ${
                                c.remaining_balance > 0 ? "text-amber-700" : "text-green-600"
                              }`}
                            >
                              Rp {Number(c.remaining_balance).toLocaleString("id-ID")}
                            </span>
                          </div>

                          {/* Quick receipt count */}
                          <div className="text-[11px] text-on-surface-variant mt-1">
                            {c.installments && c.installments.length > 0 ? (
                              <span>
                                {c.installments.length}x pembayaran dicatat
                              </span>
                            ) : (
                              <span className="text-error font-medium">Belum ada cicilan</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 align-top">
                          {c.status === "TERDAFTAR_KELAS" ? (
                            <div className="inline-flex flex-col items-start gap-1">
                              <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">school</span>
                                Masuk Kelas
                              </span>
                              <span className="text-[11px] text-on-surface-variant font-semibold">
                                Kelas: {c.synced_student?.classes?.class_name || c.synced_student?.class_name || "-"}
                              </span>
                            </div>
                          ) : c.status === "LUNAS" ? (
                            <span className="bg-green-100 text-green-800 border border-green-300 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">check_circle</span>
                              Lunas
                            </span>
                          ) : c.status === "MENCICIL" ? (
                            <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">pending</span>
                              Mencicil
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-800 border border-red-300 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              Belum Bayar
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 align-top text-center">
                          <div className="flex flex-col gap-1.5 items-center justify-center">
                            {/* Pay Installment Button */}
                            <button
                              onClick={() => openPayModal(c)}
                              className="w-full bg-primary hover:bg-primary-container text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[14px]">payments</span>
                              Bayar Cicilan
                            </button>

                            {/* Sync to Class Button */}
                            {c.status !== "TERDAFTAR_KELAS" ? (
                              <button
                                onClick={() => openSyncModal(c)}
                                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all"
                              >
                                <span className="material-symbols-outlined text-[14px]">meeting_room</span>
                                Masukkan Kelas
                              </button>
                            ) : null}

                            {/* Delete Candidate */}
                            <button
                              onClick={() => handleDeleteCandidate(c)}
                              className="text-error hover:bg-red-50 p-1 rounded text-xs transition-colors flex items-center gap-1 mt-1 opacity-60 hover:opacity-100"
                              title="Hapus Calon Siswa"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: DAFTAR CALON SISWA BARU                                          */}
      {/* ========================================================================= */}
      {mounted && isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 overflow-y-auto p-4 py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-outline-variant pb-4">
              <div>
                <h3 className="font-headline-md text-primary font-bold text-xl">Daftar Calon Siswa Baru (PPDB)</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Tahun Ajaran {addForm.academic_year} - SD &amp; SMP Taruna Islam Pekanbaru
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-on-surface-variant hover:text-error p-1 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Row 1: Nama, Jenjang & Tahun Ajaran */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Nama Lengkap Calon Siswa *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Contoh: Muhammad Rayhan"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Jenjang Sekolah *
                  </label>
                  <select
                    value={addForm.target_grade}
                    onChange={(e) => setAddForm({ ...addForm, target_grade: e.target.value as "SD" | "SMP" })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold"
                  >
                    <option value="SD">SD Taruna Islam</option>
                    <option value="SMP">SMP Taruna Islam</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Tahun Ajaran *
                  </label>
                  <select
                    value={addForm.academic_year}
                    onChange={(e) => setAddForm({ ...addForm, academic_year: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold bg-white"
                  >
                    {academicYearOptions.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr} {yr === defaultAcademicYear ? "(PPDB Baru)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Jenis Kelamin & Tempat/Tanggal Lahir */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={addForm.gender}
                    onChange={(e) => setAddForm({ ...addForm, gender: e.target.value as "L" | "P" })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Tempat Lahir
                  </label>
                  <input
                    type="text"
                    value={addForm.pob}
                    onChange={(e) => setAddForm({ ...addForm, pob: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                    placeholder="Pekanbaru"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={addForm.dob}
                    onChange={(e) => setAddForm({ ...addForm, dob: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Nama Ortu & No WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Nama Orang Tua / Wali
                  </label>
                  <input
                    type="text"
                    value={addForm.parent_name}
                    onChange={(e) => setAddForm({ ...addForm, parent_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                    placeholder="Nama Ayah/Bunda"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    No. WhatsApp Orang Tua (Untuk Notifikasi Kwitansi) *
                  </label>
                  <input
                    type="text"
                    value={addForm.parent_phone}
                    onChange={(e) => setAddForm({ ...addForm, parent_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                    placeholder="Contoh: 081234567890"
                  />
                </div>
              </div>

              {/* Skema Uang Masuk & Kalkulator Diskon */}
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-3">
                <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                  <span className="font-bold text-primary text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">percent</span>
                    Skema Biaya &amp; Kalkulator Diskon
                  </span>
                  <span className="text-xs text-on-surface-variant">T.A. {addForm.academic_year}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                      Biaya Dasar Uang Masuk (Normal)
                    </label>
                    <input
                      type="number"
                      value={addForm.base_amount}
                      onChange={(e) => setAddForm({ ...addForm, base_amount: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                      Kategori Potongan / Diskon
                    </label>
                    <select
                      value={addForm.discount_type}
                      onChange={(e) => handleDiscountTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm outline-none font-medium"
                    >
                      {DISCOUNT_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                      Nominal Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      value={addForm.discount_amount}
                      onChange={(e) =>
                        setAddForm({ ...addForm, discount_amount: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm font-semibold outline-none text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                      Catatan Diskon (Opsional / Pimpinan)
                    </label>
                    <input
                      type="text"
                      value={addForm.discount_notes}
                      onChange={(e) => setAddForm({ ...addForm, discount_notes: e.target.value })}
                      placeholder="Misal: Memo Ustadz Fulan / Anak ke-3"
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm outline-none"
                    />
                  </div>
                </div>

                {/* Total Nett */}
                <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                  <span className="font-bold text-on-surface text-sm">TOTAL KEWAJIBAN UANG MASUK (NETT):</span>
                  <span className="text-xl font-bold text-primary">
                    Rp {Math.max(0, addForm.base_amount - addForm.discount_amount).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Bayar Uang Muka / Cicilan 1 Langsung? */}
              <div className="p-4 rounded-xl border border-outline-variant bg-white space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.payInitial}
                    onChange={(e) => setAddForm({ ...addForm, payInitial: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-bold text-on-surface">
                    Langsung catat Cicilan Ke-1 / Uang Muka sekarang?
                  </span>
                </label>

                {addForm.payInitial && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                        Nominal Uang Muka (Rp)
                      </label>
                      <input
                        type="number"
                        value={addForm.initial_payment}
                        onChange={(e) =>
                          setAddForm({ ...addForm, initial_payment: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-primary rounded-lg text-sm font-bold text-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                        Metode Pembayaran
                      </label>
                      <select
                        value={addForm.payment_method}
                        onChange={(e) => setAddForm({ ...addForm, payment_method: e.target.value })}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm outline-none"
                      >
                        <option value="TUNAI">TUNAI (Kasir)</option>
                        <option value="TRANSFER">TRANSFER BANK</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 border border-outline text-on-surface py-2.5 rounded-xl font-bold hover:bg-surface-container-low transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="flex-[2] bg-primary text-on-primary font-bold py-2.5 rounded-xl shadow hover:bg-primary-container transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${submittingAdd ? "animate-spin" : ""}`}>
                    {submittingAdd ? "sync" : "save"}
                  </span>
                  {submittingAdd ? "Menyimpan Calon Siswa..." : "Daftarkan Calon Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BAYAR CICILAN PSB                                                */}
      {/* ========================================================================= */}
      {mounted && isPayModalOpen && selectedCandidate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 overflow-y-auto p-4 py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-outline-variant pb-4">
              <div>
                <h3 className="font-headline-md text-primary font-bold text-xl">Pembayaran Cicilan Uang Masuk</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {selectedCandidate.full_name} ({selectedCandidate.registration_no}) - T.A.{" "}
                  {selectedCandidate.academic_year}
                </p>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-on-surface-variant hover:text-error p-1 rounded-lg transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Candidate Financial Snapshot */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant text-center mb-4">
              <div>
                <span className="text-[11px] font-bold text-on-surface-variant uppercase block">Total Kewajiban</span>
                <span className="font-bold text-sm text-on-surface">
                  Rp {Number(selectedCandidate.total_amount).toLocaleString("id-ID")}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-green-700 uppercase block">Sudah Dibayar</span>
                <span className="font-bold text-sm text-green-700">
                  Rp {Number(selectedCandidate.total_paid).toLocaleString("id-ID")}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase block">Sisa Tagihan</span>
                <span className="font-bold text-sm text-amber-700">
                  Rp {Number(selectedCandidate.remaining_balance).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Previous Installments Accordion / List */}
            <div className="mb-5">
              <span className="font-bold text-xs uppercase text-on-surface-variant tracking-wider block mb-2">
                Riwayat Cicilan Sebelumnya:
              </span>
              {selectedCandidate.installments && selectedCandidate.installments.length > 0 ? (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {selectedCandidate.installments.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-outline-variant bg-white text-xs"
                    >
                      <div>
                        <span className="font-bold text-primary">Cicilan Ke-{inst.installment_step}</span>
                        <span className="text-on-surface-variant ml-2">({inst.receipt_no})</span>
                        <div className="text-[11px] text-on-surface-variant">
                          {new Date(inst.payment_date).toLocaleDateString("id-ID")} • {inst.payment_method}
                          {inst.notes && ` • "${inst.notes}"`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface">
                          Rp {Number(inst.amount).toLocaleString("id-ID")}
                        </span>
                        <button
                          type="button"
                          onClick={() => openReceiptModal(selectedCandidate, inst)}
                          title="Cetak Kwitansi"
                          className="p-1 rounded text-primary hover:bg-primary-container/30 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">print</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">Belum ada cicilan yang tercatat.</p>
              )}
            </div>

            {/* Payment Form */}
            <form onSubmit={handlePaySubmit} className="space-y-4 border-t border-outline-variant pt-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                  Nominal Cicilan yang Dibayar (Rp) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 border border-primary rounded-xl text-base font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="0"
                  />
                </div>

                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setPayAmount(selectedCandidate.remaining_balance)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                  >
                    Bayar Lunas (Rp {Number(selectedCandidate.remaining_balance).toLocaleString("id-ID")})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayAmount(1000000)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors"
                  >
                    Rp 1.000.000
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayAmount(500000)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors"
                  >
                    Rp 500.000
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none font-medium"
                  >
                    <option value="TUNAI">TUNAI (Kasir Sekolah)</option>
                    <option value="TRANSFER">TRANSFER BANK</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Contoh: Titipan Ayah / Transfer Mandiri"
                  className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 border border-outline text-on-surface py-2.5 rounded-xl font-bold hover:bg-surface-container-low transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPay || payAmount <= 0}
                  className="flex-[2] bg-primary text-on-primary font-bold py-2.5 rounded-xl shadow hover:bg-primary-container transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${submittingPay ? "animate-spin" : ""}`}>
                    {submittingPay ? "sync" : "payments"}
                  </span>
                  {submittingPay ? "Memproses Pembayaran..." : "Simpan & Cetak Kwitansi"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SINKRONISASI KE SISWA AKTIF (PENEMPATAN KELAS)                   */}
      {/* ========================================================================= */}
      {mounted && isSyncModalOpen && syncCandidate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 overflow-y-auto p-4 py-8">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-auto">
            <div className="flex justify-between items-center mb-4 border-b border-outline-variant pb-3">
              <div>
                <h3 className="font-headline-md text-primary font-bold text-lg">Tempatkan ke Kelas (Siswa Aktif)</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Sinkronisasi Calon Siswa ke Tabel Siswa Aktif Tahun Ajaran Baru
                </p>
              </div>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="text-on-surface-variant hover:text-error p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSyncSubmit} className="space-y-4">
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant space-y-1 text-sm">
                <div>
                  <span className="text-xs text-on-surface-variant">Nama Siswa:</span>{" "}
                  <strong>{syncCandidate.full_name}</strong>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant">Jenjang:</span>{" "}
                  <span className="font-bold text-primary">{syncCandidate.target_grade}</span>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant">Status Pembayaran:</span>{" "}
                  <span className="font-bold text-green-700">{syncCandidate.status}</span> (Sisa: Rp{" "}
                  {Number(syncCandidate.remaining_balance).toLocaleString("id-ID")})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                  Pilih Kelas Penempatan ({syncCandidate.target_grade}) *
                </label>
                <select
                  required
                  value={syncClassId}
                  onChange={(e) => setSyncClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-primary rounded-xl text-sm font-bold text-primary outline-none"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classesList
                    .filter((c) => c.grade_level === syncCandidate.target_grade)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Kelas {c.class_name} ({c.grade_level})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Hanya menampilkan kelas dengan jenjang {syncCandidate.target_grade}.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">
                  Nomor Induk Siswa (NIS) - Opsional
                </label>
                <input
                  type="text"
                  value={syncNis}
                  onChange={(e) => setSyncNis(e.target.value)}
                  placeholder="Kosongkan jika menggunakan No. Registrasi"
                  className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-sm outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="flex-1 border border-outline text-on-surface py-2.5 rounded-xl font-bold hover:bg-surface-container-low transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingSync || !syncClassId}
                  className="flex-[2] bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow hover:bg-blue-800 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${submittingSync ? "animate-spin" : ""}`}>
                    {submittingSync ? "sync" : "how_to_reg"}
                  </span>
                  {submittingSync ? "Menyinkronkan..." : "Tempatkan ke Kelas"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CETAK KWITANSI RESMI PSB                                         */}
      {/* ========================================================================= */}
      {mounted && isReceiptModalOpen && receiptData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 overflow-y-auto p-4 py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative my-auto">
            <div className="flex justify-between items-center mb-4 no-print border-b border-outline-variant pb-3">
              <span className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">print</span>
                Pratinjau Kwitansi Pembayaran
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendWhatsAppNotification(receiptData.candidate, receiptData.installment)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                  Kirim WA
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-primary hover:bg-primary-container text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  Cetak / PDF
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="text-on-surface-variant hover:text-error p-1 rounded-lg"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Printable Receipt Layout */}
            <div className="border-2 border-primary/40 rounded-xl p-6 bg-amber-50/20 text-on-surface">
              {/* Receipt Header */}
              <div className="flex items-center justify-between border-b-2 border-primary/20 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-1 border border-outline-variant shrink-0">
                    <img
                      src="https://i.ibb.co.com/p6Cwtnhr/Untitled-July-18-2026-at-09-37-16.png"
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary text-base leading-tight">
                      SD - SMP TARUNA ISLAM PEKANBARU
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Yayasan Taruna Islam • Jl. Tuah Karya / Taruna Islam No. 1, Pekanbaru
                    </p>
                    <p className="text-[11px] text-on-surface-variant font-medium">
                      Penerimaan Siswa Baru (PSB) Tahun Ajaran {receiptData.candidate.academic_year}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-sm text-primary tracking-wider uppercase block">
                    KWITANSI PSB
                  </span>
                  <span className="text-xs font-mono font-bold text-on-surface block mt-0.5">
                    {receiptData.installment.receipt_no}
                  </span>
                </div>
              </div>

              {/* Receipt Content */}
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-on-surface-variant">Telah Terima Dari</span>
                  <span className="col-span-2 font-bold text-on-surface">
                    : {receiptData.candidate.parent_name || receiptData.candidate.full_name}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <span className="text-on-surface-variant">Untuk Siswa / Jenjang</span>
                  <span className="col-span-2 font-bold text-primary">
                    : {receiptData.candidate.full_name} ({receiptData.candidate.target_grade}) - Reg:{" "}
                    {receiptData.candidate.registration_no}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <span className="text-on-surface-variant">Uraian Pembayaran</span>
                  <span className="col-span-2 font-medium">
                    : Pembayaran Cicilan Ke-{receiptData.installment.installment_step} Uang Masuk (PSB) T.A.{" "}
                    {receiptData.candidate.academic_year}
                    {receiptData.installment.notes ? ` (${receiptData.installment.notes})` : ""}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <span className="text-on-surface-variant">Metode / Tanggal</span>
                  <span className="col-span-2">
                    : {receiptData.installment.payment_method} •{" "}
                    {new Date(receiptData.installment.payment_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Amount Highlight */}
                <div className="p-3 bg-white rounded-lg border border-primary/20 flex justify-between items-center my-3">
                  <div>
                    <span className="text-xs uppercase font-bold text-on-surface-variant block">
                      Jumlah Uang yang Diterima
                    </span>
                    <span className="text-2xl font-bold text-green-700">
                      Rp {Number(receiptData.installment.amount).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-on-surface-variant block">Sisa Kewajiban Uang Masuk</span>
                    <span className="text-base font-bold text-amber-700">
                      Rp {Number(receiptData.candidate.remaining_balance).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="text-xs text-on-surface-variant border-t border-dashed border-outline-variant pt-2 flex justify-between">
                  <span>
                    Total Biaya PSB: Rp {Number(receiptData.candidate.total_amount).toLocaleString("id-ID")}
                  </span>
                  <span>
                    Total Masuk: Rp {Number(receiptData.candidate.total_paid).toLocaleString("id-ID")}
                  </span>
                  <span className="font-bold">
                    Status: {receiptData.candidate.status === "LUNAS" ? "LUNAS ✅" : "MENCICIL ⏳"}
                  </span>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 pt-6 text-center text-xs">
                  <div>
                    <p className="text-on-surface-variant mb-12">Penyetor,</p>
                    <p className="font-bold underline">
                      {receiptData.candidate.parent_name || "( Orang Tua Siswa )"}
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant mb-12">Pekanbaru, Bagian Keuangan,</p>
                    <p className="font-bold underline">( Kasir / Bendahara Sekolah )</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
