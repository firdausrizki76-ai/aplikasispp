'use client';

import React from 'react';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-transition">
      {children}
    </div>
  );
}
