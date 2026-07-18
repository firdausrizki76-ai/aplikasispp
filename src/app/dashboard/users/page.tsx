"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const [userRole, setUserRole] = useState("admin");

  const fetchUsers = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true });
      
    if (!error && data) {
      setUsers(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(profile?.role || "admin");
      }
      setIsCheckingRole(false);
    };
    
    checkRole();
    fetchUsers();
  }, []);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', email: '', password: '', role: '', status: '' });
  const [addFormData, setAddFormData] = useState({ full_name: '', email: '', password: '', role: 'admin' });
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditFormData({ 
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'admin', 
      status: user.status || 'aktif' 
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          ...editFormData
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui pengguna");
      
      setIsEditModalOpen(false);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, full_name: editFormData.full_name, email: editFormData.email, role: editFormData.role, status: editFormData.status } : u));
    } catch (err: any) {
      alert("Gagal memperbarui pengguna: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (confirm(`Apakah Anda yakin ingin menonaktifkan pengguna ${user.full_name || 'ini'}?`)) {
      const supabase = createClient();
      const { error } = await supabase.from('profiles').update({ status: 'tidak aktif' }).eq('id', user.id);
      if (!error) {
        setUsers(users.map(u => u.id === user.id ? { ...u, status: 'tidak aktif' } : u));
      } else {
        alert("Gagal menonaktifkan pengguna: " + error.message);
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAddError("");
    
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addFormData),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat pengguna");
      }
      
      setIsAddModalOpen(false);
      setAddFormData({ full_name: '', email: '', password: '', role: 'admin' });
      fetchUsers(); // Refresh data
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isCheckingRole) {
    return (
      <div className="view-section h-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium">Memeriksa hak akses...</p>
        </div>
      </div>
    );
  }

  if (userRole !== "pimpinan") {
    return (
      <div className="view-section h-full flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-outline-variant max-w-md w-full text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-error-container text-error rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 className="font-headline-sm text-primary">Akses Ditolak</h2>
          <p className="font-body-md text-on-surface-variant">
            Hanya <strong>pimpinan</strong> yang memiliki hak akses untuk melihat dan mengelola pengguna sistem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="view-section">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Manajemen Pengguna
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Kelola akses Admin dan Pimpinan aplikasi Bayar SPP Pro.
            </p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary text-on-primary px-4 py-2 rounded-xl shadow hover:bg-primary-container transition-all flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined">person_add</span>
            Tambah Pengguna
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    ID Akun
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Nama Lengkap
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Peran
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Status
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0 text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-on-surface-variant"
                    >
                      Memuat data dari Supabase...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4 font-mono text-xs text-on-surface-variant truncate max-w-[120px]" title={user.id}>
                        {user.id}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-container text-primary rounded-full flex items-center justify-center font-bold">
                            {(user.full_name || 'A').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold">{user.full_name || 'Admin Tanpa Nama'}</div>
                            <div className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[12px]">mail</span>
                              {user.email || 'Email belum disinkronisasi'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'pimpinan' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.status?.toLowerCase() === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.status === 'aktif' ? 'Aktif' : (user.status === 'tidak aktif' ? 'Tidak Aktif' : (user.status || 'Aktif'))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {user.id !== "default_or_something" && (
                          <>
                            <button 
                              onClick={() => openEditModal(user)}
                              className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-secondary/10 transition-colors" 
                              title="Edit Pengguna"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user)}
                              className="text-error hover:text-red-800 p-2 rounded-lg hover:bg-error-container transition-colors" 
                              title="Nonaktifkan Pengguna"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-on-surface-variant"
                    >
                      Belum ada data admin tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Edit Pengguna */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Edit Pengguna</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Lengkap</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white focus:border-primary outline-none" 
                          type="text" 
                          value={editFormData.full_name}
                          onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})}
                          required
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Email</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white focus:border-primary outline-none" 
                          type="email" 
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                          required
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Password Baru (Opsional)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white focus:border-primary outline-none" 
                          type="password" 
                          placeholder="Kosongkan jika tidak ingin diubah"
                          minLength={6}
                          value={editFormData.password}
                          onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Peran Akses</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={editFormData.role}
                          onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                        >
                            <option value="admin">Admin</option>
                            <option value="pimpinan">Pimpinan</option>
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Status Pengguna</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={editFormData.status}
                          onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                        >
                            <option value="aktif">Aktif</option>
                            <option value="tidak aktif">Tidak Aktif</option>
                        </select>
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

      {/* Modal Tambah Pengguna */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Tambah Pengguna Baru</h3>
                
                {addError && (
                  <div className="bg-error-container text-error p-3 rounded-lg text-sm mb-4">
                    {addError}
                  </div>
                )}
                
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Lengkap</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                          type="text" 
                          required
                          value={addFormData.full_name}
                          onChange={(e) => setAddFormData({...addFormData, full_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Email</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                          type="email" 
                          required
                          value={addFormData.email}
                          onChange={(e) => setAddFormData({...addFormData, email: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Password</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                          type="password" 
                          required
                          minLength={6}
                          value={addFormData.password}
                          onChange={(e) => setAddFormData({...addFormData, password: e.target.value})}
                        />
                        <p className="text-xs text-on-surface-variant mt-1">Minimal 6 karakter.</p>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Peran Akses</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={addFormData.role}
                          onChange={(e) => setAddFormData({...addFormData, role: e.target.value})}
                        >
                            <option value="admin">Admin</option>
                            <option value="pimpinan">Pimpinan</option>
                        </select>
                    </div>
                    
                    <div className="flex gap-3 mt-8">
                        <button 
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="flex-1 px-4 py-3 border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors font-bold"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors font-bold disabled:opacity-50"
                        >
                            {submitting ? 'Memproses...' : 'Buat Akun'}
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
