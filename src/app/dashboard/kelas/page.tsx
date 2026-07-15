"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

  return (
    <>
      <div className="view-section relative">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Master Data Kelas
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Kelola struktur kelas SD dan SMP.
            </p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow"
          >
            <span className="material-symbols-outlined text-sm">add</span>Tambah
            Kelas
          </button>
        </div>
        
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
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
                    <td colSpan={3} className="p-8 text-center text-on-surface-variant">Memuat data dari Supabase...</td>
                  </tr>
                ) : classes.length > 0 ? (
                  classes.map(cls => (
                    <tr key={cls.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-1">{cls.grade_level}</span></td>
                      <td className="px-6 py-4 font-medium">{cls.class_name}</td>
                      <td className="px-6 py-4">{cls.homeroom_teacher || '-'}</td>
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
    </>
  );
}
