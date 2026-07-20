"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export default function KelasPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [formData, setFormData] = useState({ jenjang: 'SD', nama: '', wali: '' });
  const [editFormData, setEditFormData] = useState({ jenjang: 'SD', nama: '', wali: '' });
  const [submitting, setSubmitting] = useState(false);

  // Modal Arrears State
  const [selectedClassArrears, setSelectedClassArrears] = useState<any>(null);
  const [isArrearsModalOpen, setIsArrearsModalOpen] = useState(false);
  const [loadingArrears, setLoadingArrears] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("classes").select("*").order("grade_level").order("class_name");
    setClasses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = await import('xlsx');
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const classesToInsert = data.map((row: any) => {
          return {
            grade_level: row['Jenjang'] || 'SD',
            class_name: row['Nama Kelas'] || row['Kelas'],
            homeroom_teacher: row['Wali Kelas'] || row['Wali'] || null
          };
        }).filter(c => c.class_name);

        if (classesToInsert.length > 0) {
          const supabase = createClient();
          const { error } = await supabase.from('classes').insert(classesToInsert);
          if (error) throw error;
          alert(`Berhasil mengimpor ${classesToInsert.length} kelas!`);
          fetchClasses();
        } else {
          alert("Tidak ada data valid yang ditemukan.");
          setLoading(false);
        }
      } catch (err: any) {
        alert("Gagal mengimpor file: " + err.message);
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    
    const { error } = await supabase.from('classes').insert([
      { 
        grade_level: formData.jenjang, 
        class_name: formData.nama, 
        homeroom_teacher: formData.wali 
      }
    ]);
    
    setSubmitting(false);
    
    if (!error) {
      setIsAddModalOpen(false);
      setFormData({ jenjang: 'SD', nama: '', wali: '' });
      fetchClasses(); // Refresh data
    } else {
      alert("Gagal menambahkan kelas: " + error.message);
    }
  };

  const openEditModal = (cls: any) => {
    setEditingClass(cls);
    setEditFormData({ 
      jenjang: cls.grade_level, 
      nama: cls.class_name, 
      wali: cls.homeroom_teacher || '' 
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    
    const { error } = await supabase.from('classes').update({ 
      grade_level: editFormData.jenjang, 
      class_name: editFormData.nama, 
      homeroom_teacher: editFormData.wali 
    }).eq('id', editingClass.id);
    
    setSubmitting(false);
    
    if (!error) {
      setIsEditModalOpen(false);
      fetchClasses();
    } else {
      alert("Gagal memperbarui kelas: " + error.message);
    }
  };

  const handleDeleteClass = async (cls: any) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kelas ${cls.class_name}? Peringatan: Kelas tidak dapat dihapus jika masih ada siswa di dalamnya.`)) {
      const supabase = createClient();
      const { error } = await supabase.from('classes').delete().eq('id', cls.id);
      
      if (!error) {
        setClasses(classes.filter(c => c.id !== cls.id));
      } else {
        alert("Gagal menghapus kelas: " + error.message);
      }
    }
  };

  const handleViewArrears = async (cls: any) => {
    setLoadingArrears(true);
    setIsArrearsModalOpen(true);
    setSelectedClassArrears({ ...cls, students: [] }); // Set empty initially

    const supabase = createClient();
    
    // Fetch all unpaid bills for students in this class
    const { data: bills, error } = await supabase
      .from("student_bills")
      .select(`
        id, 
        nominal,
        students!inner (
          id,
          name,
          class_id
        )
      `)
      .eq("status", "Belum Lunas")
      .eq("students.class_id", cls.id);

    if (!error && bills) {
      const studentMap = new Map();
      bills.forEach((bill: any) => {
        const stId = bill.students.id;
        if (!studentMap.has(stId)) {
          studentMap.set(stId, {
            name: bill.students.name,
            totalBills: 0,
            totalNominal: 0
          });
        }
        const st = studentMap.get(stId);
        st.totalBills += 1;
        st.totalNominal += Number(bill.nominal);
      });
      setSelectedClassArrears({
        ...cls,
        students: Array.from(studentMap.values()).sort((a, b) => b.totalNominal - a.totalNominal)
      });
    }
    setLoadingArrears(false);
  };

  return (
    <>
      <div className="view-section relative h-full flex flex-col">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Master Data Kelas
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Kelola struktur kelas SD dan SMP.
            </p>
          </div>
          <div className="flex gap-2">
            <label className="bg-secondary hover:bg-secondary-container text-on-secondary hover:text-on-secondary-container px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow cursor-pointer text-sm">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Import Excel
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
            </label>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>Tambah Kelas
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden flex-1">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Jenjang
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Nama Kelas
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Wali Kelas
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0 text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-on-surface-variant">Memuat data dari Supabase...</td>
                  </tr>
                ) : classes.length > 0 ? (
                  classes.map(cls => (
                    <tr key={cls.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-1">{cls.grade_level}</span></td>
                      <td className="px-6 py-4 font-medium">
                        <button 
                          onClick={() => handleViewArrears(cls)}
                          className="text-primary hover:underline font-bold text-left"
                          title="Lihat Tunggakan Kelas"
                        >
                          {cls.class_name}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleViewArrears(cls)}
                          className="hover:text-primary hover:underline text-left"
                          title="Lihat Tunggakan Kelas"
                        >
                          {cls.homeroom_teacher || '-'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(cls)}
                          className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-secondary/10 transition-colors" 
                          title="Edit Kelas"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteClass(cls)}
                          className="text-error hover:text-red-800 p-2 rounded-lg hover:bg-error-container transition-colors" 
                          title="Hapus Kelas"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-on-surface-variant">Belum ada kelas terdaftar.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah Kelas */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Tambah Kelas Baru</h3>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Jenjang</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={formData.jenjang}
                          onChange={(e) => setFormData({...formData, jenjang: e.target.value})}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Kelas</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          placeholder="Contoh: VII-A" 
                          required 
                          value={formData.nama}
                          onChange={(e) => setFormData({...formData, nama: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Wali Kelas (Opsional)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          value={formData.wali}
                          onChange={(e) => setFormData({...formData, wali: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 border border-outline text-on-surface py-3 rounded-lg font-bold hover:bg-gray-50">Batal</button>
                        <button type="submit" disabled={submitting} className="flex-1 bg-primary text-on-primary py-3 rounded-lg font-bold hover:bg-primary-container disabled:opacity-50">
                          {submitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {/* Modal Edit Kelas */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Edit Kelas</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Jenjang</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={editFormData.jenjang}
                          onChange={(e) => setEditFormData({...editFormData, jenjang: e.target.value})}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Kelas</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          placeholder="Contoh: VII-A" 
                          required 
                          value={editFormData.nama}
                          onChange={(e) => setEditFormData({...editFormData, nama: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Wali Kelas (Opsional)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          value={editFormData.wali}
                          onChange={(e) => setEditFormData({...editFormData, wali: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button 
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="flex-1 px-4 py-3 border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors font-bold"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors font-bold disabled:opacity-50"
                        >
                            {submitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {/* Modal Lihat Tunggakan Kelas */}
      {isArrearsModalOpen && selectedClassArrears && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[80vh] my-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-outline-variant bg-surface-container-lowest">
              <div>
                <h3 className="font-title-lg text-title-lg text-primary tracking-tight">Tunggakan {selectedClassArrears.class_name}</h3>
                <p className="text-sm text-on-surface-variant mt-1">Wali Kelas: {selectedClassArrears.homeroom_teacher || '-'}</p>
              </div>
              <button 
                onClick={() => setIsArrearsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-surface-container-lowest">
              {loadingArrears ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-on-surface-variant">Memuat data tunggakan...</p>
                </div>
              ) : selectedClassArrears.students?.length > 0 ? (
                <ul className="space-y-3">
                  {selectedClassArrears.students.map((st: any, index: number) => (
                    <li key={index} className="flex justify-between items-center p-4 rounded-xl border border-outline-variant bg-white shadow-sm hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center font-bold">
                          {st.name.substring(0,1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{st.name}</p>
                          <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px] text-error">receipt_long</span>
                            {st.totalBills} Tagihan belum lunas
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-error">Rp {st.totalNominal.toLocaleString('id-ID')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-10 flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-green-600">done_all</span>
                  </div>
                  <p className="font-bold text-lg text-on-surface">Hebat!</p>
                  <p className="text-on-surface-variant">Tidak ada siswa yang menunggak di kelas ini.</p>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-outline-variant bg-surface-container-low flex justify-between items-center">
              <Link href="/dashboard/tunggakan" onClick={() => setIsArrearsModalOpen(false)}>
                <button className="text-primary hover:text-primary-container font-bold flex items-center gap-2 text-sm hover:underline">
                  Lihat Detail Tunggakan
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </Link>
              <button 
                onClick={() => setIsArrearsModalOpen(false)}
                className="bg-surface hover:bg-surface-container-high border border-outline-variant text-on-surface px-5 py-2 rounded-xl font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
