'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { name: 'Pembayaran', href: '/dashboard/pembayaran', icon: 'payments' },
    { name: 'Tunggakan', href: '/dashboard/tunggakan', icon: 'assignment_late' },
    { name: 'Transaksi Harian', href: '/dashboard/harian', icon: 'receipt_long' },
    { name: 'Penjualan Seragam', href: '/dashboard/seragam', icon: 'checkroom' },
    { name: 'Data Siswa', href: '/dashboard/siswa', icon: 'badge' },
    { name: 'Data Kelas', href: '/dashboard/kelas', icon: 'meeting_room' },
    { name: 'Log Audit', href: '/dashboard/audit', icon: 'history_edu' },
    { name: 'Manajemen Pengguna', href: '/dashboard/users', icon: 'manage_accounts' },
  ];

  const bottomNavItems = [
    { name: 'Pengaturan', href: '/dashboard/pengaturan', icon: 'settings' },
    { name: 'Laporan Yayasan', href: '/dashboard/laporan', icon: 'analytics' },
    { name: 'Tutup Buku', href: '/dashboard/tutup-buku', icon: 'inventory_2' },
  ];

  return (
    <aside 
      className={`bg-primary h-screen w-64 fixed left-0 top-0 border-r border-outline-variant dark:border-outline shadow-sm flex flex-col py-6 z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Close button for mobile */}
      <button 
        onClick={onClose}
        className="md:hidden absolute top-4 right-4 text-on-primary hover:bg-white/10 p-2 rounded-lg"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      <div className="px-6 mb-10 flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shrink-0">
          <img src="https://i.ibb.co.com/p6Cwtnhr/Untitled-July-18-2026-at-09-37-16.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-on-primary leading-none">Bayar SPP Pro</h1>
          <p className="font-label-md text-label-md text-on-primary/60 mt-1">Sistem Keuangan</p>
          <p className="text-[10px] uppercase font-bold text-secondary-container mt-1 bg-black/20 inline-block px-2 py-0.5 rounded">T.A. {
            (() => {
              const d = new Date();
              const m = d.getMonth();
              const y = d.getFullYear();
              return m >= 6 ? `${y}/${y+1}` : `${y-1}/${y}`;
            })()
          }</p>
        </div>
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`nav-item mx-2 flex items-center px-4 py-3 gap-3 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container font-bold'
                  : 'text-on-primary/70 hover:text-on-primary hover:bg-primary-container/50 font-body-md text-body-md'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className={isActive ? 'font-body-md text-body-md' : ''}>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 pb-4 pt-2">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`nav-item mx-2 flex items-center px-4 py-3 gap-3 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container font-bold'
                  : 'text-on-primary/70 hover:text-on-primary hover:bg-primary-container/50 font-body-md text-body-md'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className={isActive ? 'font-body-md text-body-md' : ''}>{item.name}</span>
            </Link>
          );
        })}
        <hr className="border-outline-variant/30 my-2 mx-4" />
        <button
          onClick={async () => {
            const { createClient } = await import('@/utils/supabase/client');
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className="mx-2 w-[calc(100%-16px)] text-on-primary/70 hover:text-on-primary flex items-center px-4 py-3 gap-3 rounded-lg hover:bg-primary-container/50 transition-colors text-left"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="font-body-md text-body-md">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
