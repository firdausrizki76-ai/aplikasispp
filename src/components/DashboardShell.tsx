'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div 
      className="flex h-screen overflow-hidden relative bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('https://i.ibb.co.com/HfWcTfx2/Whats-App-Image-2026-07-18-at-09-34-41.jpg')" }}
    >
      {/* Light Overlay for fading effect */}
      <div className="absolute inset-0 bg-white/80 md:bg-white/90 z-0 pointer-events-none"></div>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - controlled by state on mobile, always visible on desktop */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 h-full transition-all duration-300 relative">
        {/* Running Text */}
        <div className="bg-primary text-white py-1.5 px-4 text-sm font-medium z-10 w-full overflow-hidden flex whitespace-nowrap border-b border-blue-900 shadow-sm">
          <div className="animate-marquee inline-block">
            ✨ Selamat datang di SD-SMP Taruna Islam Pekanbaru! Disiplin, Berilmu dan Berakhlak Mulia. ✨
          </div>
        </div>

        {/* Mobile Header */}
        <header className="md:hidden bg-primary text-on-primary h-16 flex items-center justify-between px-4 z-30 sticky top-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1 shrink-0">
              <img src="https://i.ibb.co.com/p6Cwtnhr/Untitled-July-18-2026-at-09-37-16.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-sm font-bold truncate">SD-SMP Taruna Islam Pekanbaru</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto pt-6 pb-12 px-4 md:pt-8 md:px-10 max-w-container-max-width mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
