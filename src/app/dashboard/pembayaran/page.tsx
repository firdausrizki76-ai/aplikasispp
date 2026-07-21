"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";
import { createPortal } from "react-dom";

type Student = Database["public"]["Tables"]["students"]["Row"];
type StudentWithClass = Student & { classes?: { class_name: string } | null };
type StudentBill = Database["public"]["Tables"]["student_bills"]["Row"];
type MasterTagihan = Database["public"]["Tables"]["master_tagihan"]["Row"];

export default function PembayaranPage() {
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentWithClass[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithClass | null>(null);
  
  const [unpaidBills, setUnpaidBills] = useState<StudentBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [masterBillsMap, setMasterBillsMap] = useState<Record<string, number>>({});
  
  // Selected bills to pay and their amounts
  const [selectedBillsToPay, setSelectedBillsToPay] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStudentsWithPayments = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch students
    const { data: students } = await supabase.from("students").select("*, classes(class_name)").order("name", { ascending: true });
    
    // Fetch payment totals
    const { data: payments } = await supabase.from("payment_transactions").select("student_id, amount");
    
    if (students) {
      // Calculate total paid per student
      const totalsMap = new Map<string, number>();
      if (payments) {
        payments.forEach(p => {
          totalsMap.set(p.student_id, (totalsMap.get(p.student_id) || 0) + p.amount);
        });
      }
      
      const mapped = students.map(s => ({
        ...s,
        total_terbayar: totalsMap.get(s.id) || 0
      }));
      
      setStudentsData(mapped);
    }
    
    // Fetch master_tagihan for discount comparison
    const { data: masterBills } = await supabase.from("master_tagihan").select("*");
    if (masterBills) {
      const map: Record<string, number> = {};
      masterBills.forEach(b => {
        map[b.nama_tagihan] = Number(b.nominal_default) || 0;
      });
      setMasterBillsMap(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStudentsWithPayments();
  }, []);

  // Search logic
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const supabase = createClient();
      supabase.from("students")
        .select("*, classes(class_name)")
        .or(`name.ilike.%${searchQuery}%,nis.ilike.%${searchQuery}%`)
        .limit(5)
        .then(({ data }) => {
          setSearchResults(data || []);
        });
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSelectStudent = async (student: StudentWithClass) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setSearchResults([]);
    setLoadingBills(true);
    setSelectedBillsToPay({});
    
    const supabase = createClient();
    const { data } = await supabase.from("student_bills")
      .select("*")
      .eq("student_id", student.id)
      .eq("status", "Belum Lunas")
      .order("tanggal_jatuh_tempo", { ascending: true });
      
    setUnpaidBills(data || []);
    setLoadingBills(false);
  };

  const toggleBillSelection = (billId: string, nominal: number) => {
    const newRecord = { ...selectedBillsToPay };
    if (newRecord[billId] !== undefined) {
      delete newRecord[billId];
    } else {
      newRecord[billId] = nominal;
    }
    setSelectedBillsToPay(newRecord);
  };

  const handlePartialAmountChange = (billId: string, amount: number) => {
    if (selectedBillsToPay[billId] !== undefined) {
      setSelectedBillsToPay(prev => ({ ...prev, [billId]: amount }));
    }
  };

  const calculateTotal = () => {
    return Object.values(selectedBillsToPay).reduce((sum, amount) => sum + amount, 0);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || Object.keys(selectedBillsToPay).length === 0) {
      alert("Pilih siswa dan minimal 1 tagihan untuk dibayar.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const totalToPay = calculateTotal();
    const receiptId = `TRX-${new Date().getTime()}`;

    // Get selected bills
    const billsToPay = unpaidBills.filter(b => selectedBillsToPay[b.id] !== undefined);

    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Insert into payment_transactions
      const transactionsToInsert = billsToPay.map(bill => ({
        receipt_id: receiptId,
        student_id: selectedStudent.id,
        bill_id: bill.id,
        jenis_tagihan: `${bill.jenis_tagihan} ${bill.bulan_tagihan}`,
        amount: selectedBillsToPay[bill.id],
        admin_id: user?.id || null
      }));

      const { error: txError } = await supabase.from("payment_transactions").insert(transactionsToInsert);
      if (txError) throw txError;

      // 3. Update student_bills status to Lunas if fully paid, otherwise reduce nominal
      const billUpdates = billsToPay.map(bill => {
        const payAmount = selectedBillsToPay[bill.id];
        const newNominal = bill.nominal - payAmount;
        const status = newNominal <= 0 ? "Lunas" : "Belum Lunas";
        return { billId: bill.id, nominal: newNominal, status };
      });
      if (billUpdates.length > 0) {
        const payload = {
          updates: billUpdates,
          userId: user?.id,
          actionDetails: `Menerima pembayaran untuk ${billUpdates.length} tagihan siswa ${selectedStudent.name}`
        };

        const res = await fetch('/api/bills/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const updateData = await res.json();
        if (!res.ok || !updateData.success) {
          throw new Error("Gagal mengupdate status tagihan: " + (updateData.error || ""));
        }
      }

      alert("Pembayaran berhasil dicatat!");
      setIsModalOpen(false);
      setSelectedStudent(null);
      setSearchQuery("");
      setUnpaidBills([]);
      setSelectedBillsToPay({});
      
      try { localStorage.removeItem('tunggakan_cache_data_v2'); } catch(e) {}
      
      // Refresh Data
      fetchStudentsWithPayments();

    } catch (err: any) {
      alert("Gagal memproses pembayaran: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="view-section">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
              Data Siswa &amp; Pembayaran
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              Lakukan input pembayaran baru atau lihat rekapitulasi pembayaran siswa di sini.
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition-all shadow"
          >
            <span className="material-symbols-outlined text-sm">add</span>Input Pembayaran Baru
          </button>
        </div>
        
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Jenjang</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Nama Siswa</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Kelas</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Status PSB</th>
                  <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Total Terbayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-on-surface">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant">Memuat data dari database...</td></tr>
                ) : studentsData.length > 0 ? (
                  studentsData.map(student => (
                    <tr key={student.id} className="hover:bg-surface-container-low/30">
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-1">{student.grade_level}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">{student.name}</td>
                      <td className="px-6 py-4">{student.classes?.class_name || student.class_name || '-'}</td>
                      <td className="px-6 py-4">
                        {/* Dummy status PSB, adjust later if needed */}
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Selesai</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-green-700">Rp {student.total_terbayar.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-on-surface-variant">Belum ada data siswa.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Input Pembayaran */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 overflow-y-auto py-10">
          <div className="bg-white rounded-xl w-full max-w-2xl p-8 shadow-lg relative my-auto">
            <div className="flex justify-between items-center mb-6 border-b border-outline-variant pb-4">
              <h3 className="font-headline-md text-primary tracking-tight">Input Pembayaran Baru</h3>
              <button onClick={() => { setIsModalOpen(false); setSelectedStudent(null); setSearchQuery(""); }} className="text-on-surface-variant hover:text-error transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmitPayment} className="space-y-5 relative">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2 ml-1">Nama Siswa / NIS</label>
                <div className="relative mb-6">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">person_search</span>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedStudent(null); }}
                    className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all" 
                    placeholder="Ketik nama atau NIS..." 
                    required 
                  />
                  
                  {/* Dropdown Search Results */}
                  {searchResults.length > 0 && !selectedStudent && (
                    <div className="absolute z-[300] w-full mt-1 bg-white border border-outline-variant rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                      {searchResults.map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => handleSelectStudent(s)}
                          className="px-4 py-3 border-b border-outline-variant hover:bg-surface-container-low cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold text-on-surface">{s.name}</div>
                            <div className="text-xs text-on-surface-variant">NIS: {s.nis || '-'} | Kelas: {s.classes?.class_name || s.class_name || '-'}</div>
                          </div>
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{s.grade_level}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Jenjang Sekolah</label>
                    <input 
                      type="text" 
                      value={selectedStudent?.grade_level || ""}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-3 text-on-surface-variant outline-none" 
                      placeholder="Pilih siswa" 
                      readOnly 
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Kelas</label>
                    <input 
                      type="text" 
                      value={selectedStudent?.classes?.class_name || selectedStudent?.class_name || ""}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-3 text-on-surface-variant outline-none" 
                      placeholder="Pilih siswa" 
                      readOnly 
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-outline-variant">
                  <span className="font-title-md text-title-md text-primary">Rincian Tagihan Belum Lunas</span>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {!selectedStudent ? (
                    <div className="text-center text-on-surface-variant py-4 text-sm">Silakan pilih siswa terlebih dahulu.</div>
                  ) : loadingBills ? (
                    <div className="text-center text-on-surface-variant py-4 text-sm">Memuat tagihan...</div>
                  ) : unpaidBills.length === 0 ? (
                    <div className="text-center text-green-600 font-medium py-4 text-sm flex items-center justify-center gap-2">
                       <span className="material-symbols-outlined">check_circle</span> Tidak ada tagihan tertunggak.
                    </div>
                  ) : (
                    unpaidBills.map(bill => (
                      <label key={bill.id} className="flex items-center gap-4 p-3 border border-outline-variant rounded-lg bg-white cursor-pointer hover:border-primary transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1 shrink-0"
                          checked={selectedBillsToPay[bill.id] !== undefined}
                          onChange={() => toggleBillSelection(bill.id, Number(bill.nominal))}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-on-surface truncate">{bill.jenis_tagihan} {bill.bulan_tagihan}</div>
                          <div className="text-xs text-error">Jatuh Tempo: {new Date(bill.tanggal_jatuh_tempo).toLocaleDateString('id-ID')}</div>
                          {masterBillsMap[bill.jenis_tagihan] && masterBillsMap[bill.jenis_tagihan] > Number(bill.nominal) && (
                            <div className="line-through text-on-surface-variant text-xs opacity-70 mt-0.5">
                              Normal: Rp {masterBillsMap[bill.jenis_tagihan].toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-primary flex items-center justify-end shrink-0">
                          {selectedBillsToPay[bill.id] !== undefined ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-on-surface-variant font-normal">Bayar:</span>
                              <input 
                                type="number" 
                                className="w-28 sm:w-32 px-2 py-1.5 border border-primary rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={selectedBillsToPay[bill.id]}
                                onChange={(e) => handlePartialAmountChange(bill.id, Number(e.target.value))}
                                max={Number(bill.nominal)}
                                min={0}
                                onClick={(e) => e.stopPropagation()} // Prevent toggling checkbox when clicking input
                              />
                            </div>
                          ) : (
                            <span className="text-sm">Rp {Number(bill.nominal).toLocaleString('id-ID')}</span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                
                <div className="pt-2 flex justify-between items-center border-t border-outline-variant mt-2">
                  <span className="font-bold text-primary">TOTAL BAYAR</span>
                  <span className="font-headline-md text-headline-md text-secondary">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border border-outline text-on-surface py-3 rounded-xl font-bold hover:bg-surface-container-low transition-all">Batal</button>
                <button 
                  className="flex-[2] bg-primary text-on-primary font-bold py-3 rounded-xl shadow hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" 
                  type="submit"
                  disabled={isSubmitting || Object.keys(selectedBillsToPay).length === 0}
                >
                  <span className={`material-symbols-outlined ${isSubmitting ? 'animate-spin' : ''}`}>
                    {isSubmitting ? 'sync' : 'send'}
                  </span>
                  {isSubmitting ? 'Memproses...' : 'Simpan & Catat Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </>
  );
}
