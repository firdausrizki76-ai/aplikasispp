"use client";

import { createClient } from "@/utils/supabase/client";
import { clearTunggakanCache } from "@/utils/tunggakanCache";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [bulkJenis, setBulkJenis] = useState("");
  const [bulkNominal, setBulkNominal] = useState("");
  const [bulkMulaiBulan, setBulkMulaiBulan] = useState("");
  const [bulkMulaiTahun, setBulkMulaiTahun] = useState("");
  const [bulkDurasi, setBulkDurasi] = useState("1");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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
      if (bulkTarget === "Semua Siswa") {
        targetList = students.filter(s => s.status === 'aktif');
      } else if (bulkTarget.startsWith("Kelas:")) {
        const classId = bulkTarget.split(":")[1];
        targetList = students.filter(s => s.class_id === classId && s.status === 'aktif');
      } else {
        targetList = students.filter(s => s.id === bulkTarget);
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
      }
    } catch (err: any) {
      alert("Gagal generate: " + err.message);
    } finally {
      setBulkSubmitting(false);
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
                      <label className="block text-sm font-bold text-slate-700 mb-1">Target Siswa</label>
                      <select 
                        value={bulkTarget}
                        onChange={(e) => setBulkTarget(e.target.value)}
                        className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:border-primary"
                        required
                      >
                        <option value="Semua Siswa">Semua Siswa (Aktif)</option>
                        <optgroup label="Per Kelas">
                          {classes.map(c => (
                            <option key={c.id} value={`Kelas:${c.id}`}>Kelas {c.class_name} ({c.grade_level})</option>
                          ))}
                        </optgroup>
                        <optgroup label="Individu Siswa">
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.nis})</option>
                          ))}
                        </optgroup>
                      </select>
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
