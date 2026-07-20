'use client';

import React, { useEffect } from 'react';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Run profile sync in background to ensure all auth.users are in public.profiles
    // This fixes the "Unknown Admin" issue in audit logs for users manually created in Supabase Dashboard
    fetch('/api/sync-profiles').catch(console.error);

    // Intercept fetch to invalidate cache on any mutation (tambah siswa, bayar tagihan, dll)
    const originalFetch = window.fetch;
    window.fetch = async function () {
      const response = await originalFetch.apply(this, arguments as any);
      
      const method = (arguments[1]?.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        try {
          sessionStorage.removeItem('dashboard_cache');
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('laporan_cache_')) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (e) {}
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div className="animate-page-transition">
      {children}
    </div>
  );
}
