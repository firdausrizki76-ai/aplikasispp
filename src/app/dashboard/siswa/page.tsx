"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function SiswaPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [masterTagihan, setMasterTagihan] = useState<any[]>([]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    nis: string;
    nama: string;
    jenjang: string;
    kelas_id: string;
    parent_phone: string;
    diskonRows: { id: number; jenis: string; persen: string }[];
  }>({
    nis: '',
    nama: '',
    jenjang: 'SD',
    kelas_id: '',
    parent_phone: '',
    diskonRows: [],
  });

  const [editData, setEditData] = useState<any>(null);

  const fetchStudents = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("students").select("*, classes(class_name)").order("name");
    setStudents(data || []);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("classes").select("*");
    setClasses(data || []);
  };

  const fetchMasterTagihan = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("master_tagihan").select("nama_tagihan");
    setMasterTagihan(data || []);
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchMasterTagihan();
  }, []);

  const addDiskonRow = (isEdit = false) => {
    if (isEdit && editData) {
      setEditData({
        ...editData,
        diskonRows: [...editData.diskonRows, { id: Date.now(), jenis: '', persen: '' }]
      });
    } else {
      setFormData({
        ...formData,
        diskonRows: [...formData.diskonRows, { id: Date.now(), jenis: '', persen: '' }]
      });
    }
  };

  const removeDiskonRow = (id: number, isEdit = false) => {
    if (isEdit && editData) {
      setEditData({
        ...editData,
        diskonRows: editData.diskonRows.filter((r: any) => r.id !== id)
      });
    } else {
      setFormData({
        ...formData,
        diskonRows: formData.diskonRows.filter((r: any) => r.id !== id)
      });
    }
  };

  const updateDiskonRow = (id: number, field: 'jenis' | 'persen', value: string, isEdit = false) => {
    if (isEdit && editData) {
      setEditData({
        ...editData,
        diskonRows: editData.diskonRows.map((r: any) => r.id === id ? { ...r, [field]: value } : r)
      });
    } else {
      setFormData({
        ...formData,
        diskonRows: formData.diskonRows.map((r: any) => r.id === id ? { ...r, [field]: value } : r)
      });
    }
  };

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
        
        const supabase = createClient();
        const { data: classList } = await supabase.from('classes').select('*');
        const classMap = new Map();
        classList?.forEach(c => {
          classMap.set(`${c.class_name}_${c.grade_level}`.toLowerCase(), c.id);
        });

        const studentsToInsert = data.map((row: any) => {
          const jenjang = row['Jenjang'] || 'SD';
          const className = row['Kelas'] || '';
          const classKey = `${className}_${jenjang}`.toLowerCase();
          const classId = classMap.get(classKey);

          const studentName = row['Nama'] || row['Nama Lengkap'] || row['Nama Siswa'];

          return {
            nis: row['NIS']?.toString() || null,
            name: studentName,
            grade_level: jenjang,
            class_id: classId || null,
            parent_phone: row['No WA Orang Tua']?.toString() || row['No WA']?.toString() || null,
            status: 'aktif'
          };
        }).filter(s => s.name);

        if (studentsToInsert.length > 0) {
          const { error } = await supabase.from('students').insert(studentsToInsert);
          if (error) throw error;
          alert(`Berhasil mengimpor ${studentsToInsert.length} siswa!`);
          fetchStudents();
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
    
    // Validate class
    if (!formData.kelas_id) {
      alert("Pilih kelas terlebih dahulu!");
      setSubmitting(false);
      return;
    }

    // Convert diskonRows to JSON object
    const diskonObj: Record<string, number> = {};
    formData.diskonRows.forEach(row => {
      if (row.jenis && row.persen) {
        diskonObj[row.jenis] = parseInt(row.persen, 10);
      }
    });

    const { error } = await supabase.from('students').insert([
      { 
        nis: formData.nis, 
        name: formData.nama, 
        grade_level: formData.jenjang,
        class_id: formData.kelas_id,
        parent_phone: formData.parent_phone,
        status: 'aktif',
        diskon: diskonObj
      }
    ]);
    
    setSubmitting(false);
    if (!error) {
      setIsAddModalOpen(false);
      setFormData({ nis: '', nama: '', jenjang: 'SD', kelas_id: '', parent_phone: '', diskonRows: [] });
      fetchStudents();
    } else {
      alert("Gagal menambahkan siswa: " + error.message);
    }
  };

  const openEditModal = (student: any) => {
    // Parse diskon JSON to rows
    const initialDiskonRows: any[] = [];
    if (student.diskon) {
      Object.entries(student.diskon).forEach(([jenis, persen]) => {
        initialDiskonRows.push({
          id: Math.random(),
          jenis,
          persen: persen?.toString() || '0'
        });
      });
    }

    setEditData({
      id: student.id,
      nis: student.nis,
      nama: student.name,
      jenjang: student.grade_level,
      kelas_id: student.class_id,
      parent_phone: student.parent_phone || '',
      status: student.status || 'aktif',
      diskonRows: initialDiskonRows
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    
    // Convert diskonRows to JSON object
    const diskonObj: Record<string, number> = {};
    editData.diskonRows.forEach((row: any) => {
      if (row.jenis && row.persen) {
        diskonObj[row.jenis] = parseInt(row.persen, 10);
      }
    });

    const { error } = await supabase.from('students').update({
      name: editData.nama,
      grade_level: editData.jenjang,
      class_id: editData.kelas_id,
      parent_phone: editData.parent_phone,
      status: editData.status,
      diskon: diskonObj
    }).eq('id', editData.id);
    
    setSubmitting(false);
    if (!error) {
      setIsEditModalOpen(false);
      fetchStudents();
    } else {
      alert("Gagal menyimpan perubahan: " + error.message);
    }
  };

  const handleActionDelete = async (type: 'nonaktif' | 'permanen') => {
    if (!studentToDelete) return;
    setSubmitting(true);
    const supabase = createClient();

    if (type === 'nonaktif') {
      const { error } = await supabase.from('students').update({ status: 'tidak aktif' }).eq('id', studentToDelete.id);
      if (!error) {
        alert("Siswa berhasil dinonaktifkan.");
        fetchStudents();
        setIsDeleteModalOpen(false);
      } else {
        alert("Gagal menonaktifkan: " + error.message);
      }
    } else {
      if (confirm(`Peringatan: Menghapus permanen akan gagal jika siswa memiliki riwayat tagihan atau transaksi. Lanjutkan?`)) {
        try {
          const res = await fetch("/api/students", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: studentToDelete.id })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Gagal menghapus siswa");
          
          alert("Siswa berhasil dihapus permanen.");
          fetchStudents();
          setIsDeleteModalOpen(false);
        } catch (err: any) {
          alert("Gagal menghapus permanen: " + err.message);
        }
      }
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="view-section h-full flex flex-col">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Master Data Siswa
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Kelola data induk siswa dan atur diskon khusus (berdasarkan Master Tagihan).
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
              <span className="material-symbols-outlined text-[18px]">
                person_add
              </span>
              Tambah Siswa
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden flex-1">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">NIS</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Nama Lengkap</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">No. WA Ortu</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Jenjang</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Kelas</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Diskon (Rp)</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Status</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-on-surface-variant">Memuat data dari Supabase...</td>
                  </tr>
                ) : students.length > 0 ? (
                  students.map(siswa => {
                    const hasDiskon = siswa.diskon && Object.keys(siswa.diskon).length > 0;
                    return (
                      <tr key={siswa.id} className="hover:bg-surface-container-low/30">
                        <td className="px-6 py-4 text-on-surface-variant font-data-mono">{siswa.nis || "-"}</td>
                        <td className="px-6 py-4 font-medium text-primary">{siswa.name}</td>
                        <td className="px-6 py-4 font-data-mono">{siswa.parent_phone || '-'}</td>
                        <td className="px-6 py-4 font-medium">{siswa.grade_level}</td>
                        <td className="px-6 py-4 font-medium">{siswa.classes?.class_name || '-'}</td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {hasDiskon ? (
                            <ul className="list-none m-0 p-0">
                              {Object.entries(siswa.diskon).map(([jenis, persen]) => (
                                <li key={jenis} className="text-secondary">{jenis}: <span className="font-bold">Rp {parseInt(persen as string).toLocaleString('id-ID')}</span></li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-on-surface-variant">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${siswa.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {siswa.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEditModal(siswa)}
                            className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-secondary/10 transition-colors" 
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button 
                            onClick={() => {
                              setStudentToDelete(siswa);
                              setIsDeleteModalOpen(true);
                            }}
                            className="text-error hover:text-red-800 p-2 rounded-lg hover:bg-error-container transition-colors" 
                            title="Hapus / Nonaktifkan Siswa"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-on-surface-variant">Belum ada siswa terdaftar.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah Siswa */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 overflow-y-auto py-10">
            <div className="bg-white rounded-xl w-full max-w-lg p-8 shadow-lg relative animate-in fade-in zoom-in duration-200 m-auto">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Tambah Siswa Baru</h3>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">NIS</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          required 
                          value={formData.nis}
                          onChange={(e) => setFormData({...formData, nis: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Lengkap</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          required 
                          value={formData.nama}
                          onChange={(e) => setFormData({...formData, nama: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">No. WA Orang Tua (Opsional)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text"
                          placeholder="Misal: 08123456789"
                          value={formData.parent_phone}
                          onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-label-md text-on-surface-variant mb-1">Jenjang</label>
                            <select 
                              className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                              value={formData.jenjang}
                              onChange={(e) => setFormData({...formData, jenjang: e.target.value, kelas_id: ''})}
                            >
                                <option value="SD">SD</option>
                                <option value="SMP">SMP</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-label-md text-on-surface-variant mb-1">Kelas</label>
                            <select 
                              className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white" 
                              required
                              value={formData.kelas_id}
                              onChange={(e) => setFormData({...formData, kelas_id: e.target.value})}
                            >
                                <option value="">Pilih Kelas</option>
                                {classes.filter(c => c.grade_level === formData.jenjang).map(c => (
                                  <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Diskon Section */}
                    <div className="mt-6 pt-4 border-t border-outline-variant">
                      <div className="flex justify-between items-center mb-3">
                        <label className="font-label-md text-on-surface-variant">Potongan / Diskon Tagihan</label>
                        <button 
                          type="button" 
                          onClick={() => addDiskonRow(false)}
                          className="text-primary text-xs font-bold hover:bg-primary/10 px-3 py-1.5 rounded flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span> Tambah Diskon
                        </button>
                      </div>
                      
                      {formData.diskonRows.length === 0 ? (
                        <p className="text-xs text-on-surface-variant/70 italic text-center py-2">Belum ada diskon ditambahkan.</p>
                      ) : (
                        <div className="space-y-2">
                          {formData.diskonRows.map(row => (
                            <div key={row.id} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                                value={row.jenis}
                                onChange={(e) => updateDiskonRow(row.id, 'jenis', e.target.value, false)}
                                required
                              >
                                <option value="">Pilih Jenis Tagihan</option>
                                {masterTagihan.map(mt => (
                                  <option key={mt.nama_tagihan} value={mt.nama_tagihan}>{mt.nama_tagihan}</option>
                                ))}
                                {/* In case of legacy data not in master */}
                                {row.jenis && !masterTagihan.find(mt => mt.nama_tagihan === row.jenis) && (
                                  <option value={row.jenis}>{row.jenis} (Tersimpan)</option>
                                )}
                              </select>
                              <div className="relative flex-1 max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium">Rp</span>
                                <input 
                                  type="number" 
                                  placeholder="0" 
                                  className="w-full px-3 py-2 pl-9 border border-outline-variant rounded-lg text-sm" 
                                  min="0" 
                                  value={row.persen}
                                  onChange={(e) => updateDiskonRow(row.id, 'persen', e.target.value, false)}
                                  required
                                />
                              </div>
                              <button 
                                type="button" 
                                onClick={() => removeDiskonRow(row.id, false)} 
                                className="text-error hover:bg-error/10 p-2 rounded-lg transition-colors flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-8 pt-4">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-on-surface-variant font-bold hover:bg-surface-container rounded-lg transition-colors">Batal</button>
                        <button type="submit" disabled={submitting} className="flex-1 bg-primary text-on-primary py-3 rounded-lg font-bold hover:bg-primary-container disabled:opacity-50 transition-colors shadow">
                          {submitting ? 'Menyimpan...' : 'Simpan Siswa'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {/* Modal Edit Siswa */}
      {isEditModalOpen && editData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 overflow-y-auto py-10">
            <div className="bg-white rounded-xl w-full max-w-lg p-8 shadow-lg relative animate-in fade-in zoom-in duration-200 m-auto">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Edit Data Siswa</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">NIS</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant" 
                          type="text" 
                          readOnly 
                          value={editData.nis || ''}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Lengkap</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          required 
                          value={editData.nama}
                          onChange={(e) => setEditData({...editData, nama: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">No. WA Orang Tua (Opsional)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text"
                          placeholder="Misal: 08123456789"
                          value={editData.parent_phone}
                          onChange={(e) => setEditData({...editData, parent_phone: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-label-md text-on-surface-variant mb-1">Jenjang</label>
                            <select 
                              className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                              value={editData.jenjang}
                              onChange={(e) => setEditData({...editData, jenjang: e.target.value, kelas_id: ''})}
                            >
                                <option value="SD">SD</option>
                                <option value="SMP">SMP</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-label-md text-on-surface-variant mb-1">Kelas</label>
                            <select 
                              className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white" 
                              required
                              value={editData.kelas_id}
                              onChange={(e) => setEditData({...editData, kelas_id: e.target.value})}
                            >
                                <option value="">Pilih Kelas</option>
                                {classes.filter(c => c.grade_level === editData.jenjang).map(c => (
                                  <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Status Siswa</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={editData.status}
                          onChange={(e) => setEditData({...editData, status: e.target.value})}
                        >
                            <option value="aktif">Aktif</option>
                            <option value="tidak aktif">Tidak Aktif</option>
                            <option value="lulus">Lulus</option>
                        </select>
                    </div>

                    {/* Diskon Section Edit */}
                    <div className="mt-6 pt-4 border-t border-outline-variant">
                      <div className="flex justify-between items-center mb-3">
                        <label className="font-label-md text-on-surface-variant">Potongan / Diskon Tagihan</label>
                        <button 
                          type="button" 
                          onClick={() => addDiskonRow(true)}
                          className="text-primary text-xs font-bold hover:bg-primary/10 px-3 py-1.5 rounded flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span> Tambah Diskon
                        </button>
                      </div>
                      
                      {editData.diskonRows?.length === 0 ? (
                        <p className="text-xs text-on-surface-variant/70 italic text-center py-2">Belum ada diskon ditambahkan.</p>
                      ) : (
                        <div className="space-y-2">
                          {editData.diskonRows?.map((row: any) => (
                            <div key={row.id} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                                value={row.jenis}
                                onChange={(e) => updateDiskonRow(row.id, 'jenis', e.target.value, true)}
                                required
                              >
                                <option value="">Pilih Jenis Tagihan</option>
                                {masterTagihan.map(mt => (
                                  <option key={mt.nama_tagihan} value={mt.nama_tagihan}>{mt.nama_tagihan}</option>
                                ))}
                                {/* In case of legacy data not in master */}
                                {row.jenis && !masterTagihan.find(mt => mt.nama_tagihan === row.jenis) && (
                                  <option value={row.jenis}>{row.jenis} (Tersimpan)</option>
                                )}
                              </select>
                              <div className="relative flex-1 max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium">Rp</span>
                                <input 
                                  type="number" 
                                  placeholder="0" 
                                  className="w-full px-3 py-2 pl-9 border border-outline-variant rounded-lg text-sm" 
                                  min="0" 
                                  value={row.persen}
                                  onChange={(e) => updateDiskonRow(row.id, 'persen', e.target.value, true)}
                                  required
                                />
                              </div>
                              <button 
                                type="button" 
                                onClick={() => removeDiskonRow(row.id, true)} 
                                className="text-error hover:bg-error/10 p-2 rounded-lg transition-colors flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-8 pt-4">
                        <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 text-on-surface-variant font-bold hover:bg-surface-container rounded-lg transition-colors">Batal</button>
                        <button type="submit" disabled={submitting} className="flex-1 bg-primary text-on-primary py-3 rounded-lg font-bold hover:bg-primary-container disabled:opacity-50 transition-colors shadow">
                          {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {/* Modal Hapus Siswa */}
      {isDeleteModalOpen && studentToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-md p-8 shadow-lg relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-error mb-4 text-center tracking-tight">Hapus Siswa</h3>
                <p className="text-center text-on-surface-variant mb-6">
                  Pilih tindakan untuk siswa <strong>{studentToDelete.name}</strong>.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    disabled={submitting}
                    onClick={() => handleActionDelete('nonaktif')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Nonaktifkan Siswa
                  </button>
                  <button 
                    disabled={submitting}
                    onClick={() => handleActionDelete('permanen')}
                    className="w-full bg-error hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Hapus Permanen
                  </button>
                  <button 
                    disabled={submitting}
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="w-full mt-2 py-3 text-on-surface-variant font-bold hover:bg-surface-container rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </>
  );
}
