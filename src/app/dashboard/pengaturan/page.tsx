"use client";

import { createClient } from "@/utils/supabase/client";
import { clearTunggakanCache } from "@/utils/tunggakanCache";
import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

function SearchableStudentSelect({
  students,
  classes,
  selectedStudent,
  onSelectStudent,
  placeholder = "Ketik nama siswa atau NIS..."
}: {
  students: any[];
  classes: any[];
  selectedStudent: any | null;
  onSelectStudent: (student: any | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return students
      .filter((s) => (s.name && s.name.toLowerCase().includes(q)) || (s.nis && s.nis.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [students, query]);

  const getClassName = (classId: string) => {
    const c = classes.find((cl) => cl.id === classId);
    return c ? `Kelas ${c.class_name}` : "-";
  };

  if (selectedStudent) {
    return (
      <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
          <div className="truncate">
            <div className="font-bold text-sm text-slate-800 truncate">{selectedStudent.name}</div>
            <div className="text-xs text-slate-500">
              NIS: {selectedStudent.nis || "-"} • {getClassName(selectedStudent.class_id)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectStudent(null)}
          className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 hover:bg-red-50 rounded ml-2 shrink-0 transition-colors"
        >
          Ganti Siswa
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary text-sm"
        />
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
          search
        </span>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {isOpen && query.trim() !== "" && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-outline-variant rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
          {filtered.length > 0 ? (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelectStudent(s);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-sm text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    NIS: {s.nis || "-"} • {getClassName(s.class_id)}
                  </div>
                </div>
                <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 shrink-0">
                  {s.grade_level || "SD"}
                </span>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-slate-500">
              Tidak ada siswa yang cocok dengan &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PengaturanPage() {
  const [masterTagihan, setMasterTagihan] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("admin");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [namaTagihan, setNamaTagihan] = useState("");
  const [tipeTagihan, setTipeTagihan] = useState("Bulanan");
  const [nominalDefault, setNominalDefault] = useState("");

  // Bulk Generate Form States
  const [bulkTarget, setBulkTarget] = useState("Semua Siswa");
  const [bulkTargetType, setBulkTargetType] = useState<"all" | "class" | "student">("all");
  const [bulkTargetClassId, setBulkTargetClassId] = useState("");
  const [bulkSelectedStudent, setBulkSelectedStudent] = useState<any | null>(null);
  const [bulkJenis, setBulkJenis] = useState("");
  const [bulkNominal, setBulkNominal] = useState("");
  const [bulkMulaiBulan, setBulkMulaiBulan] = useState("");
  const [bulkMulaiTahun, setBulkMulaiTahun] = useState(new Date().getFullYear().toString());
  const [bulkDurasi, setBulkDurasi] = useState("1");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  
  // Bulk delete states
  const [bulkDeleteTargetType, setBulkDeleteTargetType] = useState<"all" | "class" | "student">("all");
  const [bulkDeleteClassId, setBulkDeleteClassId] = useState("");
  const [bulkDeleteSelectedStudent, setBulkDeleteSelectedStudent] = useState<any | null>(null);
  const [bulkDeleteJenis, setBulkDeleteJenis] = useState("");
  const [bulkDeleteMulaiBulan, setBulkDeleteMulaiBulan] = useState("");
  const [bulkDeleteMulaiTahun, setBulkDeleteMulaiTahun] = useState(new Date().getFullYear().toString());
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

  const monthsStr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const supabase = createClient();

  const fetchMasterTagihan = async () => {
    setLoading(true);
    const { data } = await supabase.from("master_tagihan").select("*").order("created_at", { ascending: true });
    setMasterTagihan(data || []);
    setLoading(false);
  };

  const fetchStudentsAndClasses = async () => {
    const [stRes, clRes] = await Promise.all([
      supabase.from("students").select("id, nis, name, grade_level, class_id, status, diskon"),
      supabase.from("classes").select("*")
    ]);
    setStudents(stRes.data || []);
    setClasses(clRes.data || []);
  };

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(profile?.role || "admin");
      }
    };
    
    checkRole();
    fetchMasterTagihan();
    fetchStudentsAndClasses();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setNamaTagihan("");
    setTipeTagihan("Bulanan");
    setNominalDefault("");
    setIsModalOpen(true);
  };

  const openEditModal = (mt: any) => {
    setEditingId(mt.id);
    setNamaTagihan(mt.nama_tagihan);
    setTipeTagihan(mt.tipe_tagihan);
    setNominalDefault(mt.nominal_default.toString());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nama_tagihan: namaTagihan,
      tipe_tagihan: tipeTagihan,
      nominal_default: parseFloat(nominalDefault) || 0
    };

    if (editingId) {
      await supabase.from("master_tagihan").update(payload).eq("id", editingId);
    } else {
      await supabase.from("master_tagihan").insert([payload]);
    }

    closeModal();
    fetchMasterTagihan();
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Hapus master tagihan ${nama}?`)) {
      await supabase.from("master_tagihan").delete().eq("id", id);
      fetchMasterTagihan();
    }
  };

  const handleBulkJenisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setBulkJenis(val);
    const mt = masterTagihan.find(m => m.nama_tagihan === val);
    if (mt) {
      setBulkNominal(mt.nominal_default.toString());
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSubmitting(true);
    
    try {
      let targetList = [];
      if (bulkTargetType === "all") {
        targetList = students.filter(s => s.status === 'aktif');
      } else if (bulkTargetType === "class") {
        if (!bulkTargetClassId) {
          alert("Silakan pilih kelas terlebih dahulu.");
          setBulkSubmitting(false);
          return;
        }
        targetList = students.filter(s => s.class_id === bulkTargetClassId && s.status === 'aktif');
      } else {
        if (!bulkSelectedStudent) {
          alert("Silakan pilih nama siswa terlebih dahulu.");
          setBulkSubmitting(false);
          return;
        }
        targetList = students.filter(s => s.id === bulkSelectedStudent.id);
      }

      if (targetList.length === 0) {
        alert("Tidak ada siswa yang dipilih atau aktif.");
        setBulkSubmitting(false);
        return;
      }

      const durasi = parseInt(bulkDurasi) || 1;
      const baseDate = new Date(parseInt(bulkMulaiTahun), parseInt(bulkMulaiBulan), 1);
      
      const insertData = [];
      const monthsStr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

      for (let i = 0; i < targetList.length; i++) {
        const s = targetList[i];
        for (let m = 0; m < durasi; m++) {
          const dp = new Date(baseDate.getTime());
          dp.setMonth(dp.getMonth() + m);
          
          const blnLabel = monthsStr[dp.getMonth()] + ' ' + dp.getFullYear();
          // Adjust to local date string yyyy-mm-dd
          const tglFormat = `${dp.getFullYear()}-${String(dp.getMonth() + 1).padStart(2, '0')}-01`;
          
          let finalNominal = parseFloat(bulkNominal) || 0;
          // Apply discount if exists for this jenis
          if (s.diskon && s.diskon[bulkJenis]) {
            const diskonNominal = s.diskon[bulkJenis];
            if (diskonNominal > 0) {
              finalNominal = Math.max(0, finalNominal - diskonNominal);
            }
          }

          insertData.push({
            student_id: s.id,
            jenis_tagihan: bulkJenis,
            nominal: finalNominal,
            tanggal_jatuh_tempo: tglFormat,
            status: 'Belum Lunas',
            bulan_tagihan: blnLabel
          });
        }
      }

      if (insertData.length > 0) {
        // Insert in batches if very large, but Supabase standard is fine for hundreds of rows
        const { error } = await supabase.from('student_bills').insert(insertData);
        if (error) throw error;
        alert(`${insertData.length} tagihan berhasil di-generate!`);
        
        // Clear tunggakan cache
        try { clearTunggakanCache(); } catch(e) {}
        
        // Reset bulk form
        setBulkJenis("");
        setBulkNominal("");
        setBulkMulaiBulan("");
        setBulkMulaiTahun("");
        setBulkDurasi("1");
        setBulkTargetType("all");
        setBulkTargetClassId("");
        setBulkSelectedStudent(null);
      }
    } catch (err: any) {
      alert("Gagal generate: " + err.message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDeleteBills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkDeleteJenis || !bulkDeleteMulaiBulan || !bulkDeleteMulaiTahun) return;
    
    if (bulkDeleteTargetType === "class" && !bulkDeleteClassId) {
      alert("Silakan pilih kelas terlebih dahulu untuk hapus masal.");
      return;
    }
    if (bulkDeleteTargetType === "student" && !bulkDeleteSelectedStudent) {
      alert("Silakan cari dan pilih siswa terlebih dahulu untuk hapus masal.");
      return;
    }

    let blnLabel = bulkDeleteMulaiBulan;
    if (bulkDeleteMulaiBulan !== 'all') {
      blnLabel = monthsStr[parseInt(bulkDeleteMulaiBulan)] + ' ' + bulkDeleteMulaiTahun;
    }

    let targetDesc = "seluruh siswa";
    let targetLabel = "";
    if (bulkDeleteTargetType === "class") {
      const cls = classes.find(c => c.id === bulkDeleteClassId);
      targetLabel = cls ? `Kelas ${cls.class_name}` : "Kelas terpilih";
      targetDesc = `seluruh siswa di ${targetLabel}`;
    } else if (bulkDeleteTargetType === "student") {
      targetLabel = bulkDeleteSelectedStudent.name;
      targetDesc = `siswa ${targetLabel}`;
    }

    if (!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus masal tagihan "${bulkDeleteJenis}" untuk ${targetDesc} pada ${bulkDeleteMulaiBulan === 'all' ? `seluruh bulan pada tahun ${bulkDeleteMulaiTahun}` : `bulan ${blnLabel}`}? Hanya tagihan dengan status "Belum Lunas" yang akan terhapus secara permanen.`)) {
      return;
    }
    
    setBulkDeleteSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/bills/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis_tagihan: bulkDeleteJenis,
          bulan_tagihan: blnLabel,
          tahun: bulkDeleteMulaiTahun,
          target_type: bulkDeleteTargetType,
          target_id: bulkDeleteTargetType === "class" ? bulkDeleteClassId : (bulkDeleteTargetType === "student" ? bulkDeleteSelectedStudent.id : null),
          target_label: targetLabel,
          userId: user?.id
        })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Gagal melakukan hapus masal");
      
      alert(data.message || `${data.count} tagihan berhasil dihapus masal.`);
      
      try { clearTunggakanCache(); } catch(e) {}
      
      setBulkDeleteJenis("");
      setBulkDeleteMulaiBulan("");
      setBulkDeleteMulaiTahun(new Date().getFullYear().toString());
      setBulkDeleteTargetType("all");
      setBulkDeleteClassId("");
      setBulkDeleteSelectedStudent(null);
    } catch (err: any) {
      alert("Gagal menghapus masal: " + err.message);
    } finally {
      setBulkDeleteSubmitting(false);
    }
  };

  return (
    <>
      <div className="view-section fade-in h-full flex flex-col">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Pengaturan Aplikasi
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Kelola Master Tagihan dan Generate Tagihan Massal.
            </p>
          </div>
        </div>
        <div className="flex justify-between items-end mb-6">
          <div className="flex gap-3">
            {userRole === "pimpinan" && (
              <button onClick={openAddModal} className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow">
                <span className="material-symbols-outlined text-sm">
                  add_circle
                </span>
                Tambah Tagihan
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Master Table Section */}
          <div className="lg:col-span-7 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">
                list_alt
              </span>
              Daftar Tagihan
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                      Nama Tagihan
                    </th>
                    <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                      Tipe
                    </th>
                    <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                      Nominal Default
                    </th>
                    {userRole === "pimpinan" && (
                      <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0 text-right">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-on-surface">
                  {loading ? (
                    <tr>
                      <td colSpan={userRole === "pimpinan" ? 4 : 3} className="p-8 text-center text-on-surface-variant">Memuat data...</td>
                    </tr>
                  ) : masterTagihan.length > 0 ? (
                    masterTagihan.map(mt => (
                      <tr key={mt.id} className="hover:bg-surface-container-low/30">
                        <td className="px-6 py-4 font-medium">{mt.nama_tagihan}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${mt.tipe_tagihan === 'Bulanan' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {mt.tipe_tagihan}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-green-700 font-medium">
                          Rp {(mt.nominal_default || 0).toLocaleString("id-ID")}
                        </td>
                        {userRole === "pimpinan" && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => openEditModal(mt)} className="p-1.5 text-secondary hover:bg-secondary-container rounded-lg transition-colors">
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button onClick={() => handleDelete(mt.id, mt.nama_tagihan)} className="p-1.5 text-error hover:bg-error-container rounded-lg transition-colors">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={userRole === "pimpinan" ? 4 : 3} className="p-8 text-center text-on-surface-variant italic">Belum ada master tagihan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bulk Generation Section */}
          <div className="lg:col-span-5 flex flex-col gap-gutter">
            {userRole === "pimpinan" ? (
              <>
                <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
                   <div className="p-5 border-b border-outline-variant bg-surface-container-low">
                  <h3 className="font-bold text-primary flex items-center gap-2 text-lg">
                    <span className="material-symbols-outlined">auto_fix_high</span>
                    Generate Tagihan Massal
                  </h3>
                </div>
                <div className="p-6">
                  <form onSubmit={handleBulkGenerate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Target Siswa</label>
                      <div className="grid grid-cols-3 gap-2 mb-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setBulkTargetType("all");
                            setBulkTarget("Semua Siswa");
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            bulkTargetType === "all"
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface hover:bg-slate-100 border-outline-variant text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">groups</span>
                          Semua Siswa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkTargetType("class");
                            if (classes.length > 0 && !bulkTargetClassId) {
                              setBulkTargetClassId(classes[0].id);
                              setBulkTarget(`Kelas:${classes[0].id}`);
                            }
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            bulkTargetType === "class"
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface hover:bg-slate-100 border-outline-variant text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                          Per Kelas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkTargetType("student");
                            if (bulkSelectedStudent) {
                              setBulkTarget(bulkSelectedStudent.id);
                            }
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            bulkTargetType === "student"
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface hover:bg-slate-100 border-outline-variant text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">person_search</span>
                          Per Siswa
                        </button>
                      </div>

                      {bulkTargetType === "class" && (
                        <div>
                          <select
                            value={bulkTargetClassId}
                            onChange={(e) => {
                              setBulkTargetClassId(e.target.value);
                              setBulkTarget(`Kelas:${e.target.value}`);
                            }}
                            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary text-sm"
                            required
                          >
                            <option value="" disabled>-- Pilih Kelas --</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                Kelas {c.class_name} ({c.grade_level})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {bulkTargetType === "student" && (
                        <SearchableStudentSelect
                          students={students}
                          classes={classes}
                          selectedStudent={bulkSelectedStudent}
                          onSelectStudent={(s) => {
                            setBulkSelectedStudent(s);
                            setBulkTarget(s ? s.id : "");
                          }}
                          placeholder="Ketik nama atau NIS siswa (contoh: abdillah)..."
                        />
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Jenis Tagihan</label>
                        <select 
                          value={bulkJenis}
                          onChange={handleBulkJenisChange}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary"
                          required
                        >
                          <option value="" disabled>-- Pilih --</option>
                          {masterTagihan.map(mt => (
                            <option key={mt.id} value={mt.nama_tagihan}>{mt.nama_tagihan}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Nominal Dasar (Rp)</label>
                        <input 
                          type="number"
                          value={bulkNominal}
                          onChange={(e) => setBulkNominal(e.target.value)}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Mulai Bulan</label>
                        <select 
                          value={bulkMulaiBulan}
                          onChange={(e) => setBulkMulaiBulan(e.target.value)}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary"
                          required
                        >
                          <option value="" disabled>Bulan</option>
                          {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                            <option key={m} value={i}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tahun</label>
                        <input 
                          type="number"
                          value={bulkMulaiTahun}
                          onChange={(e) => setBulkMulaiTahun(e.target.value)}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary"
                          placeholder="2024"
                          required
                          min="2020"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Durasi</label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={bulkDurasi}
                            onChange={(e) => setBulkDurasi(e.target.value)}
                            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary pr-12"
                            min="1"
                            required
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">Bulan</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={bulkSubmitting || masterTagihan.length === 0}
                      className="w-full mt-4 bg-gradient-to-r from-primary to-blue-600 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 hover:opacity-90 transition-opacity shadow disabled:opacity-50"
                    >
                      {bulkSubmitting ? (
                        <><span className="material-symbols-outlined animate-spin">refresh</span> Memproses...</>
                      ) : (
                        <><span className="material-symbols-outlined">rocket_launch</span> Eksekusi Generate Tagihan</>
                      )}
                    </button>
                  </form>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-red-200 mt-6 overflow-hidden">
                <div className="p-4 bg-red-50 border-b border-red-200">
                  <h3 className="font-bold text-red-700 flex items-center gap-2 text-lg">
                    <span className="material-symbols-outlined">delete_sweep</span>
                    Hapus Tagihan Massal
                  </h3>
                  <p className="text-xs text-red-600 mt-1 ml-7">Hapus tagihan yang salah ter-generate. (Hanya tagihan Belum Lunas yang akan terhapus).</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handleBulkDeleteBills} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Target Siswa yang Dihapus</label>
                      <div className="grid grid-cols-3 gap-2 mb-2.5">
                        <button
                          type="button"
                          onClick={() => setBulkDeleteTargetType("all")}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            bulkDeleteTargetType === "all"
                              ? "bg-red-600 text-white border-red-600 shadow-sm"
                              : "bg-surface hover:bg-red-50 border-outline-variant text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">groups</span>
                          Semua Siswa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkDeleteTargetType("class");
                            if (classes.length > 0 && !bulkDeleteClassId) {
                              setBulkDeleteClassId(classes[0].id);
                            }
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            bulkDeleteTargetType === "class"
                              ? "bg-red-600 text-white border-red-600 shadow-sm"
                              : "bg-surface hover:bg-red-50 border-outline-variant text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                          Per Kelas
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkDeleteTargetType("student")}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            bulkDeleteTargetType === "student"
                              ? "bg-red-600 text-white border-red-600 shadow-sm"
                              : "bg-surface hover:bg-red-50 border-outline-variant text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">person_search</span>
                          Per Siswa
                        </button>
                      </div>

                      {bulkDeleteTargetType === "class" && (
                        <div>
                          <select
                            value={bulkDeleteClassId}
                            onChange={(e) => setBulkDeleteClassId(e.target.value)}
                            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-red-400 text-sm"
                            required
                          >
                            <option value="" disabled>-- Pilih Kelas --</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                Kelas {c.class_name} ({c.grade_level})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {bulkDeleteTargetType === "student" && (
                        <SearchableStudentSelect
                          students={students}
                          classes={classes}
                          selectedStudent={bulkDeleteSelectedStudent}
                          onSelectStudent={(s) => setBulkDeleteSelectedStudent(s)}
                          placeholder="Ketik nama atau NIS siswa yang tagihannya ingin dihapus..."
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Jenis Tagihan</label>
                        <select 
                          value={bulkDeleteJenis}
                          onChange={(e) => setBulkDeleteJenis(e.target.value)}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-red-400"
                          required
                        >
                          <option value="" disabled>-- Pilih --</option>
                          {masterTagihan.map(mt => (
                            <option key={mt.id} value={mt.nama_tagihan}>{mt.nama_tagihan}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Bulan</label>
                        <select 
                          value={bulkDeleteMulaiBulan}
                          onChange={(e) => setBulkDeleteMulaiBulan(e.target.value)}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-red-400"
                          required
                        >
                          <option value="" disabled>Bulan</option>
                          <option value="all">Semua Bulan (Satu Tahun)</option>
                          {monthsStr.map((m, i) => (
                            <option key={m} value={i}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tahun</label>
                        <input 
                          type="number"
                          value={bulkDeleteMulaiTahun}
                          onChange={(e) => setBulkDeleteMulaiTahun(e.target.value)}
                          className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-red-400"
                          placeholder="2024"
                          required
                          min="2020"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={bulkDeleteSubmitting || masterTagihan.length === 0}
                      className="w-full mt-4 bg-red-600 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 hover:bg-red-700 transition-colors shadow disabled:opacity-50"
                    >
                      {bulkDeleteSubmitting ? (
                        <><span className="material-symbols-outlined animate-spin">refresh</span> Memproses...</>
                      ) : (
                        <><span className="material-symbols-outlined">delete_forever</span> Eksekusi Hapus Massal</>
                      )}
                    </button>
                  </form>
                </div>
              </div>
              </>
            ) : (
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant flex flex-col justify-center items-center text-center h-full">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">lock</span>
                <p className="font-body-md text-on-surface-variant font-medium">
                  Hanya pimpinan yang dapat membuat, mengedit, dan meng-generate tagihan. Silahkan hubungi pimpinan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Tambah/Edit Master Tagihan */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md p-8 shadow-lg relative">
            <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">
              {editingId ? "Edit Master Tagihan" : "Tambah Master Tagihan"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">Nama Tagihan</label>
                <input
                  type="text"
                  required
                  value={namaTagihan}
                  onChange={(e) => setNamaTagihan(e.target.value)}
                  className="w-full px-4 py-3 border border-outline-variant rounded-lg"
                  placeholder="Contoh: SPP, Uang Gedung..."
                />
              </div>
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">Tipe Tagihan</label>
                <select
                  required
                  value={tipeTagihan}
                  onChange={(e) => setTipeTagihan(e.target.value)}
                  className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                >
                  <option value="Bulanan">Bulanan (Rutinitas Tiap Bulan)</option>
                  <option value="Tahunan">Tahunan (Sekali Setahun)</option>
                  <option value="Sekali Bayar">Sekali Bayar (Selama Bersekolah)</option>
                </select>
              </div>
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">Nominal Default (Rp)</label>
                <input
                  type="number"
                  required
                  value={nominalDefault}
                  onChange={(e) => setNominalDefault(e.target.value)}
                  className="w-full px-4 py-3 border border-outline-variant rounded-lg"
                  placeholder="150000"
                />
              </div>

              <div className="mt-8 flex gap-3 pt-4 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 text-on-surface-variant font-bold hover:bg-surface-container rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary-container transition-colors shadow"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
