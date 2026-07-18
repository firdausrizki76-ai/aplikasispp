"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function SeragamPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  const fetchSales = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("sales").select(`*, students (name)`).order("created_at", { ascending: false }).limit(10);
    setSales(data || []);
  };

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      const { data: invData } = await supabase.from("inventory").select("*").order("item_name");
      setInventory(invData || []);
      
      const { data: salesData } = await supabase.from("sales").select(`*, students (name)`).order("created_at", { ascending: false }).limit(10);
      setSales(salesData || []);

      const { data: stuData } = await supabase.from("students").select("id, name, grade_level").order("name");
      setStudents(stuData || []);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserRole(user.user_metadata?.role || '');
      }
      
      setLoading(false);
    };
    fetchData();
  }, []);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({ grade_level: 'SD', item_name: '', stock_quantity: '0', unit_price: '0' });
  const [editFormData, setEditFormData] = useState({ grade_level: 'SD', item_name: '', stock_quantity: '0', unit_price: '0' });
  const [transactionData, setTransactionData] = useState({ student_id: '', item_id: '', quantity: '1' });
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("inventory").select("*").order("item_name");
    setInventory(data || []);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('inventory').insert([{
      grade_level: formData.grade_level,
      item_name: formData.item_name,
      stock_quantity: parseInt(formData.stock_quantity),
      unit_price: parseFloat(formData.unit_price)
    }]);
    
    setSubmitting(false);
    if (!error) {
      setIsAddModalOpen(false);
      setFormData({ grade_level: 'SD', item_name: '', stock_quantity: '0', unit_price: '0' });
      fetchInventory();
    } else {
      alert("Gagal menambahkan item: " + error.message);
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditFormData({
      grade_level: item.grade_level || 'SD',
      item_name: item.item_name,
      stock_quantity: item.stock_quantity.toString(),
      unit_price: item.unit_price.toString()
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('inventory').update({
      grade_level: editFormData.grade_level,
      item_name: editFormData.item_name,
      stock_quantity: parseInt(editFormData.stock_quantity),
      unit_price: parseFloat(editFormData.unit_price)
    }).eq('id', editingItem.id);
    
    setSubmitting(false);
    if (!error) {
      setIsEditModalOpen(false);
      fetchInventory();
    } else {
      alert("Gagal memperbarui item: " + error.message);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (confirm(`Apakah Anda yakin ingin menghapus item ${item.item_name}?`)) {
      const supabase = createClient();
      const { error } = await supabase.from('inventory').delete().eq('id', item.id);
      if (!error) {
        setInventory(inventory.filter(i => i.id !== item.id));
      } else {
        alert("Gagal menghapus item: " + error.message);
      }
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionData.student_id || !transactionData.item_id || !transactionData.quantity) {
      alert("Mohon lengkapi semua data transaksi");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // Dapatkan data item yang dipilih
    const selectedItem = inventory.find(i => i.id === transactionData.item_id);
    if (!selectedItem) {
      alert("Item tidak ditemukan");
      setSubmitting(false);
      return;
    }

    const qty = parseInt(transactionData.quantity);
    if (selectedItem.stock_quantity < qty) {
      alert("Stok tidak mencukupi!");
      setSubmitting(false);
      return;
    }

    const totalPrice = selectedItem.unit_price * qty;

    // 1. Insert ke tabel sales
    const { error: salesError } = await supabase.from('sales').insert([{
      item_name: selectedItem.item_name,
      student_id: transactionData.student_id,
      quantity: qty,
      total_price: totalPrice
    }]);

    if (salesError) {
      alert("Gagal mencatat transaksi: " + salesError.message);
      setSubmitting(false);
      return;
    }

    // 2. Kurangi stok di inventory
    const newStock = selectedItem.stock_quantity - qty;
    await supabase.from('inventory').update({ stock_quantity: newStock }).eq('id', selectedItem.id);

    setSubmitting(false);
    setIsTransactionModalOpen(false);
    setTransactionData({ student_id: '', item_id: '', quantity: '1' });
    fetchInventory();
    fetchSales();
    alert("Transaksi berhasil dicatat!");
  };

  return (
    <>
      <div className="view-section">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Penjualan Seragam
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Kelola penjualan seragam, pantau sisa stok, dan catat pembeli.
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-secondary hover:bg-secondary-container text-on-secondary px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow"
            >
              <span className="material-symbols-outlined text-sm">
                inventory_2
              </span>
              Tambah Stok &amp; Item
            </button>
            <button 
              onClick={() => setIsTransactionModalOpen(true)}
              className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow"
            >
              <span className="material-symbols-outlined text-sm">
                add_shopping_cart
              </span>
              Transaksi Baru
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden mb-8">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              inventory
            </span>
            Data Stok Seragam
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Jenjang
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Nama Barang
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Sisa Stok
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Harga Satuan
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
                ) : inventory.length > 0 ? (
                  inventory.map(item => (
                    <tr key={item.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-1">{item.grade_level || '-'}</span></td>
                      <td className="px-6 py-4 font-medium">{item.item_name}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${item.stock_quantity < 10 ? 'text-error' : 'text-primary'}`}>{item.stock_quantity}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-green-700">{(item.unit_price || 0).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {userRole === 'pimpinan' ? (
                          <>
                            <button 
                              onClick={() => openEditModal(item)}
                              className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-secondary/10 transition-colors" 
                              title="Edit Stok"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteItem(item)}
                              className="text-error hover:text-red-800 p-2 rounded-lg hover:bg-error-container transition-colors" 
                              title="Hapus Stok"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-on-surface-variant italic cursor-help" title="Hubungi pimpinan untuk edit data">Hubungi Pimpinan</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
                       <span className="material-symbols-outlined text-4xl text-outline">inventory_2</span>
                       <p>Belum ada data stok barang.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              history
            </span>
            Riwayat Penjualan Terakhir
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Tanggal
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Pembeli (Siswa)
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Barang
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Jumlah
                  </th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">
                    Total Harga
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-on-surface-variant">Memuat riwayat...</td>
                  </tr>
                ) : sales.length > 0 ? (
                  sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4 text-on-surface-variant">{new Date(sale.created_at).toLocaleDateString('id-ID')}</td>
                      <td className="px-6 py-4 font-medium">{sale.students?.name || '-'}</td>
                      <td className="px-6 py-4">{sale.item_name}</td>
                      <td className="px-6 py-4">{sale.quantity}</td>
                      <td className="px-6 py-4 font-medium text-green-700">{(sale.total_price || 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
                       <span className="material-symbols-outlined text-4xl text-outline">history</span>
                       <p>Belum ada riwayat penjualan.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah Stok & Item */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Tambah Barang</h3>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Jenjang</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={formData.grade_level}
                          onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Barang</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          required 
                          value={formData.item_name}
                          onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Stok Awal</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="number" 
                          required 
                          min="0"
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Harga Satuan (Rp)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="number" 
                          required 
                          min="0"
                          value={formData.unit_price}
                          onChange={(e) => setFormData({...formData, unit_price: e.target.value})}
                        />
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
                            {submitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {/* Modal Edit Stok & Item */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight">Edit Barang</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Jenjang</label>
                        <select 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={editFormData.grade_level}
                          onChange={(e) => setEditFormData({...editFormData, grade_level: e.target.value})}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Nama Barang</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="text" 
                          required 
                          value={editFormData.item_name}
                          onChange={(e) => setEditFormData({...editFormData, item_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Stok Tersisa</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="number" 
                          required 
                          min="0"
                          value={editFormData.stock_quantity}
                          onChange={(e) => setEditFormData({...editFormData, stock_quantity: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Harga Satuan (Rp)</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg" 
                          type="number" 
                          required 
                          min="0"
                          value={editFormData.unit_price}
                          onChange={(e) => setEditFormData({...editFormData, unit_price: e.target.value})}
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

      {/* Modal Transaksi Baru */}
      {isTransactionModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl">add_shopping_cart</span>
                  Catat Transaksi Seragam
                </h3>
                
                <form onSubmit={handleTransactionSubmit} className="space-y-4">
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Pilih Siswa</label>
                        <select 
                          required
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={transactionData.student_id}
                          onChange={(e) => setTransactionData({...transactionData, student_id: e.target.value})}
                        >
                          <option value="">-- Pilih Siswa --</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.grade_level})</option>
                          ))}
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Pilih Barang Seragam</label>
                        <select 
                          required
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white"
                          value={transactionData.item_id}
                          onChange={(e) => setTransactionData({...transactionData, item_id: e.target.value})}
                        >
                          <option value="">-- Pilih Barang --</option>
                          {inventory.filter(i => i.stock_quantity > 0).map(i => (
                            <option key={i.id} value={i.id}>
                              {i.item_name} (Sisa: {i.stock_quantity} | Rp {(i.unit_price || 0).toLocaleString('id-ID')})
                            </option>
                          ))}
                        </select>
                    </div>
                    <div>
                        <label className="block font-label-md text-on-surface-variant mb-1">Jumlah Dibeli</label>
                        <input 
                          className="w-full px-4 py-3 border border-outline-variant rounded-lg bg-white" 
                          type="number" 
                          required
                          min="1"
                          value={transactionData.quantity}
                          onChange={(e) => setTransactionData({...transactionData, quantity: e.target.value})}
                        />
                    </div>
                    
                    <div className="flex gap-3 mt-8">
                        <button 
                            type="button"
                            onClick={() => setIsTransactionModalOpen(false)}
                            className="flex-1 px-4 py-3 border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors font-bold"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? 'Memproses...' : 'Catat Penjualan'}
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
