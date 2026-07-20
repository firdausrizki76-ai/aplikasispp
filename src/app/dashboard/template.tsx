'use client';

import React, { useEffect } from 'react';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Run profile sync in background to ensure all auth.users are in public.profiles
    // This fixes the "Unknown Admin" issue in audit logs for users manually created in Supabase Dashboard
    fetch('/api/sync-profiles').catch(console.error);
  }, []);

  return (
    <div className="animate-page-transition">
      {children}
    </div>
  );
}
