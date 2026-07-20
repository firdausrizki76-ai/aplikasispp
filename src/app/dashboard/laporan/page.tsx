"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function LaporanPage() {
  const [loading, setLoading] = useState(true);
  
  // Stats for cards
  const [stats, setStats] = useState({ 
    totalSD: 0, 
    totalSMP: 0, 
    totalSeragam: 0,
    studentsSD: 0,
    studentsSMP: 0,
    percentLunasSD: 0,
    percentLunasSMP: 0
  });
  const [classStats, setClassStats] = useState<Record<string, { total: number, lunas: number, jenjang: string }>>({});
  
  // Date range filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Download Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"excel" | "pdf">("excel");
  const [downloadType, setDownloadType] = useState<"SD" | "SMP" | "SERAGAM_SD" | "SERAGAM_SMP" | "PERSENTASE_SD" | "PERSENTASE_SMP">("SD");
  const [downloading, setDownloading] = useState(false);

  const generateTahunAjaranOptions = () => {
    const today = new Date();
    let currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    if (currentMonth < 7) {
      currentYear -= 1;
    }
    
    const options = [];
    // Start from 2023 as base year, up to 2100 as requested by client
    for (let i = 2023; i <= 2100; i++) {
      options.push({
        label: `${i}/${i + 1}`,
        start: `${i}-07-01`,
        end: `${i + 1}-06-30`
      });
    }
    return options;
  };
  
  const tahunAjaranOptions = generateTahunAjaranOptions();
  const [selectedTA, setSelectedTA] = useState<string>("");

  useEffect(() => {
    setTahunAjaranIni();
  }, []);

  const fetchData = async () => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    try {
      const cacheKey = `laporan_cache_${startDate}_${endDate}`;
      let data = null;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) data = JSON.parse(cached);
      } catch (e) {}

      if (!data) {
        const res = await fetch(`/api/laporan?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error("Gagal mengambil data laporan");
        data = await res.json();
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {}
      }
      
      const bills = data.bills || [];
      const sales = data.sales || [];
      const { SD: countSD, SMP: countSMP } = data.counts || { SD: 0, SMP: 0 };

      let sdBillsTotal = 0;
      let smpBillsTotal = 0;
      let sdBillsLunas = 0;
      let smpBillsLunas = 0;
      
      const newClassStats: Record<string, { total: number, lunas: number, jenjang: string }> = {};

      bills.forEach((b: any) => {
        const gl = (b.students as any)?.classes?.grade_level?.toUpperCase() || (b.students as any)?.grade_level?.toUpperCase() || "";
        const className = (b.students as any)?.classes?.class_name || (b.students as any)?.class_name || "Tanpa Kelas";
        const isLunas = b.status?.toLowerCase() === 'lunas';

        if (gl.includes("SD")) {
          sdBillsTotal++;
          if (isLunas) sdBillsLunas++;
        }
        else if (gl.includes("SMP")) {
          smpBillsTotal++;
          if (isLunas) smpBillsLunas++;
        }

        if (!newClassStats[className]) {
          newClassStats[className] = { total: 0, lunas: 0, jenjang: gl.includes("SD") ? "SD" : gl.includes("SMP") ? "SMP" : "Lainnya" };
        }
        newClassStats[className].total++;
        if (isLunas) newClassStats[className].lunas++;
      });

      setClassStats(newClassStats);

      setStats({
        totalSD: sdBillsTotal,
        totalSMP: smpBillsTotal,
        totalSeragam: sales.length,
        studentsSD: countSD,
        studentsSMP: countSMP,
        percentLunasSD: sdBillsTotal > 0 ? Math.round((sdBillsLunas / sdBillsTotal) * 100) : 0,
        percentLunasSMP: smpBillsTotal > 0 ? Math.round((smpBillsLunas / smpBillsTotal) * 100) : 0
      });
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat memuat laporan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const setTahunAjaranIni = () => {
    const today = new Date();
    let currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    if (currentMonth < 7) {
      currentYear -= 1;
    }
    const label = `${currentYear}/${currentYear + 1}`;
    setStartDate(`${currentYear}-07-01`);
    setEndDate(`${currentYear + 1}-06-30`);
    setSelectedTA(label);
  };

  const handleTAChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTA(val);
    if (val) {
      const opt = tahunAjaranOptions.find(o => o.label === val);
      if (opt) {
        setStartDate(opt.start);
        setEndDate(opt.end);
      }
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (downloadType === "SERAGAM_SD" || downloadType === "SERAGAM_SMP") {
        await generateSeragamReport(downloadType === "SERAGAM_SD" ? "SD" : "SMP");
      } else if (downloadType === "PERSENTASE_SD" || downloadType === "PERSENTASE_SMP") {
        await generatePersentaseReport(downloadType === "PERSENTASE_SD" ? "SD" : "SMP");
      } else {
        await generateSekolahReport(downloadType);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat membuat laporan.");
    } finally {
      setDownloading(false);
      setIsModalOpen(false);
    }
  };

  const generateSekolahReport = async (jenjang: "SD" | "SMP") => {
    // Fetch all required data from API to bypass RLS
    const res = await fetch(`/api/laporan?startDate=${startDate}&endDate=${endDate}`);
    if (!res.ok) throw new Error("Gagal mengambil data untuk laporan");
    const data = await res.json();
    
    // Filter students by jenjang
    const students = (data.students || []).filter((s: any) => {
      const gl = s.classes?.grade_level || s.grade_level || "";
      return gl.includes(jenjang);
    });

    const bills = data.bills || [];
    const master = data.master_tagihan || [];
    
    const tagihanTypes = (master || []).map((m: any) => m.nama_tagihan).filter((t: string) => t.toLowerCase() !== 'uang psb');
    
    // Unique months present in the bills
    const monthsSet = new Set<string>();
    (bills || []).forEach((b: any) => {
      if (b.bulan_tagihan) monthsSet.add(b.bulan_tagihan);
    });
    
    // Define chronological sorting for Indonesian months
    const monthOrder = ["Juli", "Agustus", "September", "Oktober", "November", "Desember", "Januari", "Februari", "Maret", "April", "Mei", "Juni"];
    const sortedMonths = Array.from(monthsSet).sort((a, b) => {
      const mA = a.split(" ")[0];
      const mB = b.split(" ")[0];
      return monthOrder.indexOf(mA) - monthOrder.indexOf(mB);
    });

    if (downloadFormat === "excel") {
      generateSekolahExcel(jenjang, students || [], bills || [], sortedMonths, tagihanTypes);
    } else {
      generateSekolahPDF(jenjang, students || [], bills || [], sortedMonths, tagihanTypes);
    }
  };

  const generateSekolahExcel = (jenjang: string, students: any[], bills: any[], months: string[], tagihanTypes: string[]) => {
    const wsData: any[][] = [];
    
    // Row 1: Title
    wsData.push([`Rekap Pembayaran Sekolah: ${jenjang} T.A.`]);
    
    // Row 2: Headers (Months)
    const row2 = ["No.", "Nama Siswa", "Kelas", "Uang PSB"];
    months.forEach(m => {
      row2.push(m);
      for (let i = 1; i < tagihanTypes.length; i++) row2.push("");
    });
    wsData.push(row2);

    // Row 3: Subheaders (Tagihan Types)
    const row3 = ["", "", "", ""];
    months.forEach(() => {
      tagihanTypes.forEach(t => row3.push(t));
    });
    wsData.push(row3);

    // Data Rows
    students.forEach((s, idx) => {
      const sBills = bills.filter(b => b.student_id === s.id && b.status?.toLowerCase() === 'lunas');
      const psbBill = sBills.find(b => b.jenis_tagihan?.toLowerCase() === 'uang psb');
      
      const formatValue = (bill: any) => {
        if (!bill) return "-";
        const tx = Array.isArray(bill.payment_transactions) ? bill.payment_transactions[0] : bill.payment_transactions;
        const dateStr = tx?.payment_date;
        const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '';
        return dateFormatted ? `${bill.nominal.toLocaleString('id-ID')} (Lunas ${dateFormatted})` : bill.nominal.toLocaleString('id-ID');
      };

      const rowData = [
        idx + 1,
        s.name,
        (s.classes as any)?.class_name || "-",
        formatValue(psbBill)
      ];

      months.forEach(m => {
        const monthBills = sBills.filter(b => b.bulan_tagihan === m);
        tagihanTypes.forEach(t => {
          const bill = monthBills.find(b => b.jenis_tagihan === t);
          rowData.push(formatValue(bill));
        });
      });
      
      wsData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merges
    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: row2.length - 1 } }); // Title
    merges.push({ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }); // No
    merges.push({ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }); // Nama
    merges.push({ s: { r: 1, c: 2 }, e: { r: 2, c: 2 } }); // Kelas
    merges.push({ s: { r: 1, c: 3 }, e: { r: 2, c: 3 } }); // PSB
    
    let currentCol = 4;
    months.forEach(() => {
      merges.push({ s: { r: 1, c: currentCol }, e: { r: 1, c: currentCol + tagihanTypes.length - 1 } });
      currentCol += tagihanTypes.length;
    });
    
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, `Rekap_Pembayaran_${jenjang}.xlsx`);
  };

  const generateSekolahPDF = (jenjang: string, students: any[], bills: any[], months: string[], tagihanTypes: string[]) => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text(`Rekap Pembayaran Sekolah: ${jenjang}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 22);

    const head1 = ["No.", "Nama Siswa", "Kelas", "Uang PSB"];
    const head2 = ["", "", "", ""];
    
    months.forEach(m => {
      head1.push(m);
      for (let i = 1; i < tagihanTypes.length; i++) head1.push("");
      tagihanTypes.forEach(t => head2.push(t));
    });

    const body = students.map((s, idx) => {
      const sBills = bills.filter(b => b.student_id === s.id && b.status?.toLowerCase() === 'lunas');
      const psbBill = sBills.find(b => b.jenis_tagihan?.toLowerCase() === 'uang psb');
      
      const formatValue = (bill: any) => {
        if (!bill) return "-";
        const tx = Array.isArray(bill.payment_transactions) ? bill.payment_transactions[0] : bill.payment_transactions;
        const dateStr = tx?.payment_date;
        const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '';
        return dateFormatted ? `${bill.nominal.toLocaleString('id-ID')} (Lunas ${dateFormatted})` : bill.nominal.toLocaleString('id-ID');
      };
      
      const row = [
        (idx + 1).toString(),
        s.name,
        (s.classes as any)?.class_name || "-",
        formatValue(psbBill)
      ];

      months.forEach(m => {
        const monthBills = sBills.filter(b => b.bulan_tagihan === m);
        tagihanTypes.forEach(t => {
          const bill = monthBills.find(b => b.jenis_tagihan === t);
          row.push(formatValue(bill));
        });
      });
      return row;
    });

    autoTable(doc, {
      startY: 30,
      head: [head1, head2],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255, halign: 'center' }
    });

    doc.save(`Rekap_Pembayaran_${jenjang}.pdf`);
  };

  const generateSeragamReport = async (jenjang: "SD" | "SMP") => {
    const res = await fetch(`/api/laporan?startDate=${startDate}&endDate=${endDate}`);
    if (!res.ok) throw new Error("Gagal mengambil data untuk laporan");
    const data = await res.json();
    const salesRaw = data.sales || [];

    // Filter by jenjang
    const sales = (salesRaw || []).filter((s: any) => {
      const gl = (s.students as any)?.classes?.grade_level || "";
      return gl === jenjang;
    });

    if (downloadFormat === "excel") {
      const wsData = [
        [`Laporan Transaksi Seragam ${jenjang}`],
        ["Tanggal", "Pembeli", "Barang", "Qty", "Total (Rp)"]
      ];
      
      (sales || []).forEach((s: any) => {
        const pembeli = s.buyer_name || (s.students as any)?.name || "Anonim";
        wsData.push([
          new Date(s.created_at).toLocaleDateString('id-ID'),
          pembeli,
          s.item_name || "-",
          s.quantity,
          s.total_price
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Auto width
      const colWidths = wsData[1].map((_, i) => ({ wch: Math.max(...wsData.map(row => row[i] ? row[i].toString().length : 0)) }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Seragam");
      XLSX.writeFile(wb, `Laporan_Seragam_${jenjang}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text(`Laporan Transaksi Seragam ${jenjang}`, 14, 15);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 22);
      
      const body = (sales || []).map((s: any) => {
        const pembeli = s.buyer_name || (s.students as any)?.name || "Anonim";
        return [
          new Date(s.created_at).toLocaleDateString('id-ID'),
          pembeli,
          s.item_name || "-",
          s.quantity,
          s.total_price.toLocaleString('id-ID')
        ];
      });

      autoTable(doc, {
        startY: 30,
        head: [["Tanggal", "Pembeli", "Barang", "Qty", "Total (Rp)"]],
        body: body,
        theme: 'grid'
      });
      doc.save(`Laporan_Seragam_${jenjang}.pdf`);
    }
  };

  const generatePersentaseReport = async (jenjang: "SD" | "SMP") => {
    if (downloadFormat !== "excel") {
      alert("Laporan Persentase Kelas hanya tersedia dalam format Excel.");
      return;
    }

    const res = await fetch(`/api/laporan?startDate=${startDate}&endDate=${endDate}`);
    if (!res.ok) throw new Error("Gagal mengambil data untuk laporan");
    const data = await res.json();
    
    // Aggregate bills by class
    const bills = data.bills || [];
    
    // Count total and paid per class
    const classStats: Record<string, { total: number, lunas: number }> = {};

    bills.forEach((b: any) => {
      const gl = b.students?.grade_level || "";
      if (gl.includes(jenjang)) {
        const className = b.students?.classes?.class_name || "Tanpa Kelas";
        if (!classStats[className]) classStats[className] = { total: 0, lunas: 0 };
        
        classStats[className].total += 1;
        if (b.status?.toLowerCase() === 'lunas') {
          classStats[className].lunas += 1;
        }
      }
    });

    const wsData: any[][] = [];
    wsData.push([`Laporan Persentase Pembayaran: ${jenjang} T.A. ${selectedTA}`]);
    wsData.push(["Kelas", "Total Tagihan", "Tagihan Lunas", "Belum Lunas", "Persentase Lunas"]);

    const sortedClasses = Object.keys(classStats).sort();
    
    sortedClasses.forEach(className => {
      const stat = classStats[className];
      const percent = stat.total > 0 ? (stat.lunas / stat.total) * 100 : 0;
      wsData.push([
        className,
        stat.total,
        stat.lunas,
        stat.total - stat.lunas,
        `${percent.toFixed(2)}%`
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto width
    const colWidths = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Persentase");
    XLSX.writeFile(wb, `Persentase_Pembayaran_${jenjang}.xlsx`);
  };

  return (
    <div className="view-section h-full flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-primary tracking-tight">Report Center Yayasan</h2>
          <p className="font-body-lg text-on-surface-variant mt-1">Pusat unduhan dan analisis data keuangan sekolah.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all hover:bg-blue-700"
        >
          <span className="material-symbols-outlined">download</span> Download Laporan
        </button>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Tahun Ajaran</label>
          <select 
            value={selectedTA}
            onChange={handleTAChange}
            className="border border-gray-300 rounded-lg px-3 py-2 w-48 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
          >
            <option value="">-- Kustom Tanggal --</option>
            {tahunAjaranOptions.map(opt => (
              <option key={opt.label} value={opt.label}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Tanggal Mulai</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => { setStartDate(e.target.value); setSelectedTA(""); }}
            className="border border-gray-300 rounded-lg px-3 py-2 w-40 text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Tanggal Akhir</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => { setEndDate(e.target.value); setSelectedTA(""); }}
            className="border border-gray-300 rounded-lg px-3 py-2 w-40 text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Siswa SD & Tunggakan */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase">Siswa SD Aktif</h3>
            <p className="text-3xl font-black text-primary mt-2">{loading ? '...' : stats.studentsSD}</p>
            <p className="text-xs text-gray-400 mt-1">Total {loading ? '...' : stats.totalSD} tagihan dalam periode ini</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-gray-500">Persentase Lunas</span>
              <span className="text-xs font-bold text-green-600">{loading ? '...' : stats.percentLunasSD}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.percentLunasSD}%` }}></div>
            </div>
          </div>
        </div>

        {/* Siswa SMP & Tunggakan */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase">Siswa SMP Aktif</h3>
            <p className="text-3xl font-black text-secondary mt-2">{loading ? '...' : stats.studentsSMP}</p>
            <p className="text-xs text-gray-400 mt-1">Total {loading ? '...' : stats.totalSMP} tagihan dalam periode ini</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-gray-500">Persentase Lunas</span>
              <span className="text-xs font-bold text-green-600">{loading ? '...' : stats.percentLunasSMP}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.percentLunasSMP}%` }}></div>
            </div>
          </div>
        </div>

        {/* Transaksi Seragam */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-outline-variant">
          <h3 className="text-sm font-bold text-gray-500 uppercase">Aktivitas Seragam</h3>
          <p className="text-3xl font-black text-green-600 mt-2">{loading ? '...' : stats.totalSeragam}</p>
          <p className="text-xs text-gray-400 mt-1">Transaksi penjualan seragam pada periode ini</p>
        </div>

        {/* Ringkasan Download */}
        <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-xl shadow-sm text-white flex flex-col justify-center items-center text-center">
          <span className="material-symbols-outlined text-[40px] mb-3 opacity-90">analytics</span>
          <h3 className="font-bold text-lg">Pusat Laporan</h3>
          <p className="text-xs text-blue-100 mt-2 leading-relaxed">Unduh laporan keuangan di bawah ini untuk analisis mendalam.</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-outline-variant mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Persentase Lunas Per Kelas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.keys(classStats).sort().map(className => {
            const stat = classStats[className];
            const percent = stat.total > 0 ? Math.round((stat.lunas / stat.total) * 100) : 0;
            return (
              <div key={className} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-gray-700">{className}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{stat.jenjang}</span>
                  </div>
                  <span className={`text-lg font-black ${percent >= 80 ? 'text-green-600' : percent >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {percent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                  <div className={`h-1.5 rounded-full ${percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${percent}%` }}></div>
                </div>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Lunas: {stat.lunas}</span>
                  <span>Total Tagihan: {stat.total}</span>
                </div>
              </div>
            );
          })}
          {Object.keys(classStats).length === 0 && !loading && (
            <div className="col-span-full py-8 text-center text-gray-400 text-sm">
              Tidak ada data tagihan pada periode ini.
            </div>
          )}
          {loading && (
            <div className="col-span-full py-12 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-gray-500 font-medium">Memuat data, silakan tunggu...</p>
              <p className="text-xs text-gray-400 mt-1">Mengambil ribuan data transaksi...</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-outline-variant flex items-center justify-center p-8 text-center text-gray-500">
        <div>
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">analytics</span>
          <p className="text-lg font-medium text-gray-700">Data siap di-export</p>
          <p className="text-sm mt-1 max-w-md mx-auto">Klik tombol <strong>Download Laporan</strong> di atas untuk menghasilkan laporan berformat Excel bersarang (Pivot) atau PDF sesuai periode yang Anda pilih.</p>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Download Laporan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:bg-gray-100 rounded-full p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Jenis Laporan</label>
                <select 
                  value={downloadType}
                  onChange={e => setDownloadType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="SD">Rekap Pembayaran Sekolah: SD</option>
                  <option value="SMP">Rekap Pembayaran Sekolah: SMP</option>
                  <option value="SERAGAM_SD">Rekap Transaksi Seragam & Stok: SD</option>
                  <option value="SERAGAM_SMP">Rekap Transaksi Seragam & Stok: SMP</option>
                  <option value="PERSENTASE_SD">Laporan Persentase Pembayaran Kelas: SD</option>
                  <option value="PERSENTASE_SMP">Laporan Persentase Pembayaran Kelas: SMP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Format Unduhan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setDownloadFormat("excel")}
                    className={`flex items-center justify-center gap-2 py-3 border rounded-xl font-semibold transition-all ${downloadFormat === 'excel' ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">table_view</span> Excel
                  </button>
                  <button 
                    onClick={() => setDownloadFormat("pdf")}
                    className={`flex items-center justify-center gap-2 py-3 border rounded-xl font-semibold transition-all ${downloadFormat === 'pdf' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span> PDF
                  </button>
                </div>
              </div>

            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition"
              >
                Batal
              </button>
              <button 
                onClick={handleDownload}
                disabled={downloading}
                className="px-6 py-2.5 font-bold bg-primary text-white rounded-xl hover:bg-blue-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Memproses...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
