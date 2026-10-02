"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

export default function SeragamPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  // Inventory Filter States
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryGrade, setInventoryGrade] = useState("all");

  // Sales Filter States
  const [salesSearch, setSalesSearch] = useState("");
  const [salesPeriod, setSalesPeriod] = useState<"all" | "today" | "this_month" | "last_month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salesGrade, setSalesGrade] = useState("all");
  const [selectedItemFilter, setSelectedItemFilter] = useState("all");
  const [salesMethodFilter, setSalesMethodFilter] = useState<"all" | "TUNAI" | "TRANSFER">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "student_asc">("date_desc");

  // Pagination for Sales
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const fetchSales = async () => {
    const supabase = createClient();
    let allSales: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("sales")
        .select(`*, students (id, name, grade_level)`)
        .order("created_at", { ascending: false })
        .range(from, from + step - 1);

      if (error) {
        console.error("Error fetching sales:", error);
        break;
      }

      if (data && data.length > 0) {
        allSales = [...allSales, ...data];
        if (data.length < step) break;
      } else {
        break;
      }
      from += step;
    }

    setSales(allSales);
  };

  const fetchInventory = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("inventory").select("*").order("item_name");
    setInventory(data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch inventory
    const { data: invData } = await supabase.from("inventory").select("*").order("item_name");
    setInventory(invData || []);
    
    // Fetch all sales (loop to overcome default 1000 limit)
    let allSales: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
      const { data: salesData, error } = await supabase
        .from("sales")
        .select(`*, students (id, name, grade_level)`)
        .order("created_at", { ascending: false })
        .range(from, from + step - 1);

      if (error) {
        console.error("Error fetching sales:", error);
        break;
      }

      if (salesData && salesData.length > 0) {
        allSales = [...allSales, ...salesData];
        if (salesData.length < step) break;
      } else {
        break;
      }
      from += step;
    }
    setSales(allSales);

    // Fetch students
    const { data: stuData } = await supabase.from("students").select("id, name, grade_level").order("name");
    setStudents(stuData || []);
    
    // Check role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setUserRole(profile?.role || user.user_metadata?.role || 'admin');
    }
    
    setLoading(false);
  };

  useEffect(() => {
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
  const [transactionMethod, setTransactionMethod] = useState<"TUNAI" | "TRANSFER">("TUNAI");
  const [submitting, setSubmitting] = useState(false);

  // Handle Sales Period Change
  const handleSalesPeriodChange = (type: "all" | "today" | "this_month" | "last_month" | "custom") => {
    setSalesPeriod(type);
    setCurrentPage(1);

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

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

  // Distinct items for filter dropdown
  const availableItems = useMemo(() => {
    const items = new Set<string>();
    sales.forEach(s => {
      if (s.item_name) items.add(s.item_name);
    });
    return Array.from(items).sort();
  }, [sales]);

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase().trim();
        if (!item.item_name.toLowerCase().includes(q)) return false;
      }
      if (inventoryGrade !== "all") {
        if (item.grade_level !== inventoryGrade) return false;
      }
      return true;
    });
  }, [inventory, inventorySearch, inventoryGrade]);

  // Filtered Sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // 1. Search Query
      if (salesSearch.trim()) {
        const q = salesSearch.toLowerCase().trim();
        const studentName = (sale.students?.name || "").toLowerCase();
        const itemName = (sale.item_name || "").toLowerCase();
        const grade = (sale.students?.grade_level || "").toLowerCase();
        
        const match = studentName.includes(q) || itemName.includes(q) || grade.includes(q);
        if (!match) return false;
      }

      // 2. Date Filter
      if (salesPeriod !== "all") {
        if (startDate) {
          const saleDate = (sale.created_at || "").slice(0, 10);
          if (saleDate < startDate) return false;
        }
        if (endDate) {
          const saleDate = (sale.created_at || "").slice(0, 10);
          if (saleDate > endDate) return false;
        }
      }

      // 3. Jenjang Filter
      if (salesGrade !== "all") {
        const studentGrade = sale.students?.grade_level || "";
        if (studentGrade !== salesGrade) return false;
      }

      // 4. Item Name Filter
      if (selectedItemFilter !== "all") {
        if (sale.item_name !== selectedItemFilter) return false;
      }

      // 5. Payment Method Filter
      if (salesMethodFilter !== "all") {
        const method = sale.payment_method || "TUNAI";
        if (method !== salesMethodFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "amount_desc") {
        return (Number(b.total_price) || 0) - (Number(a.total_price) || 0);
      }
      if (sortBy === "amount_asc") {
        return (Number(a.total_price) || 0) - (Number(b.total_price) || 0);
      }
      if (sortBy === "student_asc") {
        return (a.students?.name || "").localeCompare(b.students?.name || "");
      }
      return 0;
    });
  }, [sales, salesSearch, salesPeriod, startDate, endDate, salesGrade, selectedItemFilter, salesMethodFilter, sortBy]);

  // Reset Sales Filters
  const handleResetSalesFilters = () => {
    setSalesSearch("");
    setSalesPeriod("all");
    setStartDate("");
    setEndDate("");
    setSalesGrade("all");
    setSelectedItemFilter("all");
    setSalesMethodFilter("all");
    setSortBy("date_desc");
    setCurrentPage(1);
  };

  // Pagination calculation for sales
  const totalSalesItems = filteredSales.length;
  const effectivePageSize = pageSize === 0 ? totalSalesItems : pageSize;
  const totalSalesPages = Math.ceil(totalSalesItems / (effectivePageSize || 1)) || 1;
  const paginatedSales = useMemo(() => {
    if (pageSize === 0) return filteredSales;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSales.slice(startIndex, startIndex + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  // Sales KPI Calculations
  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  }, [filteredSales]);

  const totalCashRevenue = useMemo(() => {
    return filteredSales
      .filter(s => (s.payment_method || 'TUNAI') === 'TUNAI')
      .reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  }, [filteredSales]);

  const totalTransferRevenue = useMemo(() => {
    return filteredSales
      .filter(s => s.payment_method === 'TRANSFER')
      .reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  }, [filteredSales]);

  const totalPcsSold = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [filteredSales]);

  const totalStockInWarehouse = useMemo(() => {
    return inventory.reduce((acc, curr) => acc + (Number(curr.stock_quantity) || 0), 0);
  }, [inventory]);

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

  const handleDeleteSale = async (sale: any) => {
    if (confirm(`Apakah Anda yakin ingin membatalkan transaksi penjualan ${sale.quantity}x ${sale.item_name}? Stok akan dikembalikan.`)) {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const res = await fetch('/api/seragam/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sale_id: sale.id, 
            item_name: sale.item_name, 
            quantity: sale.quantity,
            userId: user?.id
          })
        });
        
        const data = await res.json();
        if (data.success) {
          setSales(sales.filter(s => s.id !== sale.id));
          fetchInventory(); // Refresh stock
          alert("Riwayat penjualan berhasil dihapus dan stok dikembalikan.");
        } else {
          alert("Gagal menghapus riwayat: " + data.error);
        }
      } catch (err: any) {
        alert("Terjadi kesalahan: " + err.message);
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
      total_price: totalPrice,
      payment_method: transactionMethod
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
    setTransactionMethod('TUNAI');
    fetchInventory();
    fetchSales();
    alert("Transaksi berhasil dicatat!");
  };

  return (
    <div className="view-section space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">checkroom</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-primary tracking-tight">
                Penjualan Seragam
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
                Kelola inventaris seragam, pantau stok barang, dan telusuri riwayat penjualan dari awal hingga kini.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-secondary hover:bg-secondary/90 text-on-secondary px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            Tambah Stok &amp; Item
          </button>
          <button 
            onClick={() => {
              setIsTransactionModalOpen(true);
              setTransactionMethod("TUNAI");
            }}
            className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add_shopping_cart</span>
            Transaksi Baru
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Penjualan</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {loading ? "..." : totalSalesItems.toLocaleString('id-ID')}
              <span className="text-xs font-normal text-on-surface-variant ml-1">Transaksi</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">receipt</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Item Terjual</p>
            <p className="text-2xl font-bold text-secondary mt-1">
              {loading ? "..." : totalPcsSold.toLocaleString('id-ID')}
              <span className="text-xs font-normal text-on-surface-variant ml-1">Pcs</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">shopping_bag</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Omzet</p>
            {userRole === 'pimpinan' ? (
              <>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {loading ? "..." : `Rp ${totalSalesRevenue.toLocaleString('id-ID')}`}
                </p>
                {!loading && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] font-semibold">
                    <span className="text-emerald-700">Tunai: Rp {totalCashRevenue.toLocaleString('id-ID')}</span>
                    <span className="text-outline">•</span>
                    <span className="text-blue-700">Transfer: Rp {totalTransferRevenue.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 mt-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px] text-outline">lock</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-surface-container rounded-md">Khusus Pimpinan</span>
              </div>
            )}
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Sisa Stok Gudang</p>
            <p className="text-2xl font-bold text-on-surface mt-1">
              {loading ? "..." : totalStockInWarehouse.toLocaleString('id-ID')}
              <span className="text-xs font-normal text-on-surface-variant ml-1">Pcs ({inventory.length} Jenis)</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">inventory</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: DATA STOK SERAGAM */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">inventory</span>
            <span className="font-bold text-primary text-sm">Data Stok Seragam</span>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              {filteredInventory.length} Barang
            </span>
          </div>

          {/* Search & Jenjang Filter for Inventory */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Cari nama seragam..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs w-48 focus:ring-1 focus:ring-primary focus:border-primary"
              />
              {inventorySearch && (
                <button 
                  onClick={() => setInventorySearch("")} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={inventoryGrade}
              onChange={(e) => setInventoryGrade(e.target.value)}
              className="px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="all">Semua Jenjang</option>
              <option value="SD">Jenjang SD</option>
              <option value="SMP">Jenjang SMP</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low/70 border-b border-outline-variant">
              <tr>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Jenjang
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Nama Barang
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Sisa Stok
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Harga Satuan
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">Memuat data dari Supabase...</td>
                </tr>
              ) : filteredInventory.length > 0 ? (
                filteredInventory.map(item => (
                  <tr key={item.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        item.grade_level === 'SD' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.grade_level || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium">{item.item_name}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${item.stock_quantity === 0 ? 'text-red-600' : item.stock_quantity < 10 ? 'text-amber-600' : 'text-primary'}`}>
                          {item.stock_quantity}
                        </span>
                        {item.stock_quantity === 0 ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Habis</span>
                        ) : item.stock_quantity < 10 ? (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Menipis</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-emerald-700">Rp {(item.unit_price || 0).toLocaleString('id-ID')}</td>
                    <td className="px-5 py-3.5 text-right flex items-center justify-end gap-1">
                      {userRole === 'pimpinan' ? (
                        <>
                          <button 
                            onClick={() => openEditModal(item)}
                            className="text-secondary hover:text-primary p-1.5 rounded-lg hover:bg-secondary/10 transition-colors" 
                            title="Edit Stok"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(item)}
                            className="text-error hover:text-red-800 p-1.5 rounded-lg hover:bg-error-container transition-colors" 
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
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-outline">inventory_2</span>
                      <p className="font-semibold text-sm">Tidak ada data stok barang yang cocok.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: RIWAYAT PENJUALAN SERAGAM (ALL HISTORICAL DATA) */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden space-y-0">
        {/* Table Title Bar */}
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">history</span>
            <span className="font-bold text-primary text-sm">Riwayat Penjualan Seragam</span>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              {totalSalesItems.toLocaleString('id-ID')} Penjualan
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
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>Semua</option>
            </select>
          </div>
        </div>

        {/* Filters and Search Bar for Sales */}
        <div className="p-4 border-b border-outline-variant/60 bg-surface-container-low/30 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Cari nama pembeli (siswa) atau nama seragam..."
                value={salesSearch}
                onChange={(e) => {
                  setSalesSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-9 py-2 bg-white border border-outline-variant rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {salesSearch && (
                <button
                  onClick={() => setSalesSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Period Buttons */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-outline-variant rounded-xl">
              <button
                onClick={() => handleSalesPeriodChange("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  salesPeriod === "all"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Semua Waktu
              </button>
              <button
                onClick={() => handleSalesPeriodChange("today")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  salesPeriod === "today"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => handleSalesPeriodChange("this_month")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  salesPeriod === "this_month"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => handleSalesPeriodChange("last_month")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  salesPeriod === "last_month"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Bulan Lalu
              </button>
              <button
                onClick={() => handleSalesPeriodChange("custom")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  salesPeriod === "custom"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Rentang Tanggal
              </button>
            </div>
          </div>

          {/* Secondary Filters for Sales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-outline-variant/40">
            {salesPeriod === "custom" ? (
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
                    className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs"
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
                    className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Jenjang Siswa
                </label>
                <select
                  value={salesGrade}
                  onChange={(e) => {
                    setSalesGrade(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-medium"
                >
                  <option value="all">Semua Jenjang</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                </select>
              </div>
            )}

            {salesPeriod === "custom" && (
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                  Jenjang Siswa
                </label>
                <select
                  value={salesGrade}
                  onChange={(e) => {
                    setSalesGrade(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-medium"
                >
                  <option value="all">Semua Jenjang</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                </select>
              </div>
            )}

            {/* Filter by Item */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                Barang Seragam
              </label>
              <select
                value={selectedItemFilter}
                onChange={(e) => {
                  setSelectedItemFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-medium"
              >
                <option value="all">Semua Barang</option>
                {availableItems.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            {/* Filter by Payment Method */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                Metode Bayar
              </label>
              <select
                value={salesMethodFilter}
                onChange={(e: any) => {
                  setSalesMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-medium"
              >
                <option value="all">Semua Metode</option>
                <option value="TUNAI">TUNAI</option>
                <option value="TRANSFER">TRANSFER</option>
              </select>
            </div>

            {/* Sort by */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                Urutan
              </label>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-outline-variant rounded-lg text-xs font-medium"
              >
                <option value="date_desc">Waktu Terbaru</option>
                <option value="date_asc">Waktu Terlama</option>
                <option value="amount_desc">Total Harga Tertinggi</option>
                <option value="amount_asc">Total Harga Terendah</option>
                <option value="student_asc">Nama Siswa (A - Z)</option>
              </select>
            </div>

            {/* Reset Filters */}
            <div className="flex items-end">
              <button
                onClick={handleResetSalesFilters}
                className="w-full py-1.5 px-3 bg-white hover:bg-surface-container text-on-surface text-xs font-semibold rounded-lg border border-outline-variant transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                Reset Filter
              </button>
            </div>
          </div>
        </div>

        {/* Sales Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low/70 border-b border-outline-variant">
              <tr>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Tanggal &amp; Waktu
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Pembeli (Siswa)
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Barang Seragam
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Jumlah (Pcs)
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Total Harga
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0">
                  Metode
                </th>
                <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-xs sticky top-0 text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant">Memuat riwayat penjualan...</td>
                </tr>
              ) : paginatedSales.length > 0 ? (
                paginatedSales.map(sale => {
                  const saleDate = new Date(sale.created_at);
                  const formattedDate = saleDate.toLocaleDateString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const formattedTime = saleDate.toLocaleTimeString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={sale.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                        <div className="font-semibold text-on-surface">{formattedDate}</div>
                        <div className="text-[11px] text-on-surface-variant/80">{formattedTime} WIB</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface">{sale.students?.name || '-'}</span>
                          {sale.students?.grade_level && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              sale.students.grade_level === 'SD' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {sale.students.grade_level}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium">{sale.item_name}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 bg-surface-container text-on-surface rounded-md font-bold text-xs">
                          {sale.quantity} Pcs
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-sm text-emerald-700">
                        Rp {(sale.total_price || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {sale.payment_method === "TRANSFER" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="material-symbols-outlined text-[13px]">account_balance</span>
                            TRANSFER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="material-symbols-outlined text-[13px]">payments</span>
                            TUNAI
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {userRole === 'pimpinan' ? (
                          <button 
                            onClick={() => handleDeleteSale(sale)}
                            className="text-error hover:bg-error-container p-1.5 rounded-lg transition-colors inline-flex items-center justify-center" 
                            title="Hapus Penjualan & Kembalikan Stok"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant italic cursor-help" title="Hubungi pimpinan untuk menghapus">
                            Akses Terbatas
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-outline">history</span>
                      <p className="font-semibold text-base text-on-surface">Belum ada riwayat penjualan yang cocok.</p>
                      <p className="text-xs text-on-surface-variant">
                        Coba sesuaikan kata kunci pencarian atau pilih filter waktu lainnya.
                      </p>
                      {(salesSearch || salesPeriod !== "all" || salesGrade !== "all" || selectedItemFilter !== "all" || salesMethodFilter !== "all") && (
                        <button
                          onClick={handleResetSalesFilters}
                          className="mt-2 px-4 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
                        >
                          Tampilkan Semua Penjualan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer for Sales */}
        {totalSalesItems > 0 && pageSize > 0 && (
          <div className="p-4 bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
            <div>
              Menampilkan <span className="font-bold text-on-surface">{Math.min((currentPage - 1) * pageSize + 1, totalSalesItems)}</span> - <span className="font-bold text-on-surface">{Math.min(currentPage * pageSize, totalSalesItems)}</span> dari <span className="font-bold text-on-surface">{totalSalesItems.toLocaleString('id-ID')}</span> transaksi
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
                Halaman {currentPage} dari {totalSalesPages}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalSalesPages))}
                disabled={currentPage === totalSalesPages}
                className="p-1.5 rounded-lg border border-outline-variant bg-white disabled:opacity-40 hover:bg-surface-container transition-colors"
                title="Halaman Selanjutnya"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
              <button
                onClick={() => setCurrentPage(totalSalesPages)}
                disabled={currentPage === totalSalesPages}
                className="p-1.5 rounded-lg border border-outline-variant bg-white disabled:opacity-40 hover:bg-surface-container transition-colors"
                title="Halaman Terakhir"
              >
                <span className="material-symbols-outlined text-sm">last_page</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah Stok & Item */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight font-bold text-xl">Tambah Barang Seragam</h3>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Jenjang</label>
                        <select 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl bg-white text-sm"
                          value={formData.grade_level}
                          onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Nama Barang</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm" 
                          type="text" 
                          required 
                          placeholder="Contoh: Baju Olahraga SD"
                          value={formData.item_name}
                          onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Stok Awal</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm" 
                          type="number" 
                          required 
                          min="0"
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Harga Satuan (Rp)</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm" 
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
                            className="flex-1 px-4 py-2.5 border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors font-bold text-sm"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors font-bold text-sm disabled:opacity-50"
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
                <h3 className="font-headline-md text-primary mb-6 text-center tracking-tight font-bold text-xl">Edit Barang Seragam</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Jenjang</label>
                        <select 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl bg-white text-sm"
                          value={editFormData.grade_level}
                          onChange={(e) => setEditFormData({...editFormData, grade_level: e.target.value})}
                        >
                            <option value="SD">SD</option>
                            <option value="SMP">SMP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Nama Barang</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm" 
                          type="text" 
                          required 
                          value={editFormData.item_name}
                          onChange={(e) => setEditFormData({...editFormData, item_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Stok Tersisa</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm" 
                          type="number" 
                          required 
                          min="0"
                          value={editFormData.stock_quantity}
                          onChange={(e) => setEditFormData({...editFormData, stock_quantity: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Harga Satuan (Rp)</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm" 
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
                            className="flex-1 px-4 py-2.5 border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors font-bold text-sm"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors font-bold text-sm disabled:opacity-50"
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
                <div className="flex justify-between items-center mb-6 border-b border-outline-variant pb-3">
                  <h3 className="font-headline-md text-primary tracking-tight flex items-center gap-2 font-bold text-xl">
                    <span className="material-symbols-outlined text-2xl">add_shopping_cart</span>
                    Catat Transaksi Seragam
                  </h3>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsTransactionModalOpen(false);
                      setTransactionMethod("TUNAI");
                    }}
                    className="text-on-surface-variant hover:text-error transition-all"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                
                <form onSubmit={handleTransactionSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Pilih Siswa</label>
                        <select 
                          required
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl bg-white text-sm"
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
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Pilih Barang Seragam</label>
                        <select 
                          required
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl bg-white text-sm"
                          value={transactionData.item_id}
                          onChange={(e) => setTransactionData({...transactionData, item_id: e.target.value})}
                        >
                          <option value="">-- Pilih Barang --</option>
                          {inventory.filter(i => i.stock_quantity > 0).map(i => (
                            <option key={i.id} value={i.id}>
                              [{i.grade_level}] {i.item_name} (Sisa: {i.stock_quantity} | Rp {(i.unit_price || 0).toLocaleString('id-ID')})
                            </option>
                          ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Jumlah Dibeli (Pcs)</label>
                        <input 
                          className="w-full px-4 py-2.5 border border-outline-variant rounded-xl bg-white text-sm" 
                          type="number" 
                          required
                          min="1"
                          value={transactionData.quantity}
                          onChange={(e) => setTransactionData({...transactionData, quantity: e.target.value})}
                        />
                    </div>

                    {/* Total Price Preview */}
                    {transactionData.item_id && transactionData.quantity && (
                      <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/60 flex items-center justify-between">
                        <span className="text-xs text-on-surface-variant font-medium">Estimasi Total:</span>
                        <span className="text-base font-bold text-emerald-700">
                          Rp {((inventory.find(i => i.id === transactionData.item_id)?.unit_price || 0) * (parseInt(transactionData.quantity) || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}

                    {/* Pilihan Metode Pembayaran: TUNAI vs TRANSFER */}
                    <div className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant space-y-2">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                        Metode Pembayaran *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTransactionMethod("TUNAI")}
                          className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            transactionMethod === "TUNAI"
                              ? "bg-green-50 border-green-500 text-green-800 ring-2 ring-green-500/20 shadow-sm"
                              : "bg-white border-outline-variant text-on-surface hover:bg-surface-container"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                          TUNAI (Kasir)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransactionMethod("TRANSFER")}
                          className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            transactionMethod === "TRANSFER"
                              ? "bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20 shadow-sm"
                              : "bg-white border-outline-variant text-on-surface hover:bg-surface-container"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">account_balance</span>
                          TRANSFER BANK
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-8">
                        <button 
                            type="button"
                            onClick={() => {
                              setIsTransactionModalOpen(false);
                              setTransactionMethod("TUNAI");
                            }}
                            className="flex-1 px-4 py-2.5 border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors font-bold text-sm"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? 'Memproses...' : 'Catat Penjualan'}
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
