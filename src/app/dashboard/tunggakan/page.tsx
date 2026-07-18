"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Database } from "@/utils/supabase/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];
type StudentWithClass = Student & { classes?: { class_name: string } | null };
type StudentBill = Database["public"]["Tables"]["student_bills"]["Row"];

interface ArrearsSummary {
  student: StudentWithClass;
  totalUnpaidBills: number; // Count of bills
  totalArrears: number; // Sum of nominal
  totalOriginalArrears: number; // Sum of original default nominals (for discount strike-through)
  bills: any[]; // Store bills for details
}

export default function TunggakanPage() {
  const [arrearsData, setArrearsData] = useState<ArrearsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<ArrearsSummary | null>(null);

  // Filters
  const [filterJenjang, setFilterJenjang] = useState<string>("");
  const [filterKelas, setFilterKelas] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    fetchArrears();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("classes").select("id, class_name").order("class_name");
    if (data) {
      setAvailableClasses(data.map(c => ({ id: c.id, name: c.class_name })));
    }
  };

  const fetchArrears = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch all unpaid bills and join with student and class info
    const { data: bills, error } = await supabase
      .from("student_bills")
      .select(`
        id, 
        nominal,
        jenis_tagihan,
        bulan_tagihan,
        student_id,
        students (
          id,
          name,
          grade_level,
          class_id,
          parent_phone,
          classes (
            class_name
          )
        )
      `)
      .eq("status", "Belum Lunas");

    const { data: masterBills } = await supabase.from("master_tagihan").select("*");
    const masterBillsMap: Record<string, number> = {};
    if (masterBills) {
      masterBills.forEach(b => {
        masterBillsMap[b.nama_tagihan] = Number(b.nominal_default) || 0;
      });
    }

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Group by student
    const studentMap = new Map<string, ArrearsSummary>();

    if (bills) {
      bills.forEach((bill: any) => {
        if (!bill.students) return; // Ignore if student deleted or missing
        
        const stId = bill.student_id;
        if (!studentMap.has(stId)) {
          studentMap.set(stId, {
            student: bill.students,
            totalUnpaidBills: 0,
            totalArrears: 0,
            totalOriginalArrears: 0,
            bills: []
          });
        }
        
        const summary = studentMap.get(stId)!;
        summary.totalUnpaidBills += 1;
        summary.totalArrears += Number(bill.nominal);
        summary.bills.push(bill);
        
        // Add to original arrears for strike-through if applicable
        const originalPrice = masterBillsMap[bill.jenis_tagihan] || Number(bill.nominal);
        summary.totalOriginalArrears += Number(originalPrice);
      });
    }

    setArrearsData(Array.from(studentMap.values()).sort((a, b) => b.totalArrears - a.totalArrears));
    setLoading(false);
  };

  const handleSendWA = (summary: ArrearsSummary) => {
    let phone = summary.student.parent_phone || '';
    // Format to 62... if starts with 0
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
    
    const text = `Halo Bapak/Ibu wali murid dari ${summary.student.name},\nKami dari pihak sekolah menginformasikan bahwa terdapat tunggakan pembayaran sebanyak ${summary.totalUnpaidBills} tagihan dengan total sebesar Rp ${summary.totalArrears.toLocaleString('id-ID')}. Mohon untuk segera diselesaikan. Terima kasih.`;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  // Apply filters
  const filteredData = arrearsData.filter(d => {
    if (filterJenjang && d.student.grade_level !== filterJenjang) return false;
    // Assuming we map class filter to class_name string matching for simplicity since class_id could be missing
    const className = d.student.classes?.class_name || d.student.class_name || "";
    if (filterKelas && className !== filterKelas) return false;
    return true;
  });

  return (
    <div className="view-section">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-error tracking-tight">Laporan Tunggakan</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            Daftar siswa yang belum melunasi kewajiban pembayaran SPP sesuai bulan berjalan.
          </p>
        </div>
        <div className="flex gap-4">
          <select 
            value={filterJenjang}
            onChange={(e) => setFilterJenjang(e.target.value)}
            className="border border-outline-variant rounded-lg px-4 py-2 bg-surface focus:ring-primary focus:border-primary outline-none"
          >
            <option value="">Semua Jenjang</option>
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
          </select>
          <select 
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="border border-outline-variant rounded-lg px-4 py-2 bg-surface focus:ring-primary focus:border-primary outline-none"
          >
            <option value="">Semua Kelas</option>
            {availableClasses.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Jenjang</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Nama Siswa</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Kelas</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Lama Menunggak</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Total Tunggakan</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Keterangan</th>
                <th className="px-6 py-4 font-bold text-on-surface-variant uppercase tracking-wider sticky top-0">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">Memuat data dari database...</td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map(d => (
                  <tr key={d.student.id} className="hover:bg-surface-container-low/30">
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-1">{d.student.grade_level}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">{d.student.name}</td>
                    <td className="px-6 py-4">{d.student.classes?.class_name || (d.student as any).class_name || '-'}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedStudent(d)}
                        className="text-error font-bold flex items-center gap-1 hover:underline hover:text-red-700 transition-colors"
                        title="Klik untuk melihat rincian tagihan"
                      >
                        {d.totalUnpaidBills} Bulan/Tagihan
                        <span className="material-symbols-outlined text-[16px]">info</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 font-medium text-error flex items-center">
                      {d.totalOriginalArrears > d.totalArrears && (
                        <span className="line-through text-on-surface-variant text-xs mr-2 opacity-70">
                          Rp {d.totalOriginalArrears.toLocaleString('id-ID')}
                        </span>
                      )}
                      Rp {d.totalArrears.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      {d.bills.some((b: any) => b.bulan_tagihan?.includes('T.A. Lalu')) ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-bold border border-amber-200">
                          Tunggakan T.A. Lalu
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleSendWA(d)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded flex items-center gap-1 font-medium transition-all shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                        </svg>
                        Hubungi (WA)
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-on-surface-variant flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-green-600">done_all</span>
                    </div>
                    <p className="font-bold text-lg text-on-surface">Hebat!</p>
                    <p>Tidak ada siswa yang menunggak tagihan saat ini.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Rincian */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-lg border border-outline-variant overflow-hidden flex flex-col max-h-[70vh] my-auto">
            <div className="flex justify-between items-center p-5 border-b border-outline-variant bg-surface-container-lowest">
              <div>
                <h3 className="font-title-lg text-title-lg text-primary">Rincian Tagihan</h3>
                <p className="text-sm text-on-surface-variant mt-1">{selectedStudent.student.name}</p>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <ul className="space-y-3">
                {selectedStudent.bills.map((bill, index) => (
                  <li key={bill.id || index} className="flex justify-between items-center p-4 rounded-xl border border-outline-variant bg-surface-container-lowest">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center">
                        <span className="material-symbols-outlined">receipt_long</span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">
                          {bill.jenis_tagihan} 
                          {bill.bulan_tagihan && <span className="text-gray-500 font-normal"> - {bill.bulan_tagihan}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-error">Rp {Number(bill.nominal).toLocaleString('id-ID')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-6 border-t border-outline-variant bg-surface-container-lowest flex justify-between items-center">
              <div>
                <p className="text-sm text-on-surface-variant">Total Tunggakan</p>
                <p className="font-bold text-lg text-error">Rp {selectedStudent.totalArrears.toLocaleString('id-ID')}</p>
              </div>
              <button 
                onClick={() => handleSendWA(selectedStudent)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow transition-all active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
                Tunda (WA)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
