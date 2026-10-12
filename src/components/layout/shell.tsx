'use client';

import { useState } from 'react';
import { TopBar } from './top-bar';
import { Sidebar } from './sidebar';
import { Footer } from './footer';
import { Toaster } from '@/components/ui/sonner';

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--warm-gray-50)]">
      <TopBar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4 sm:p-6 lg:p-10">
            {children}
          </div>
          <Footer />
        </main>
      </div>
      <Toaster 
        position="top-right" 
        richColors 
        toastOptions={{
          style: {
            borderRadius: '1rem',
            boxShadow: 'var(--shadow-lg)',
          },
        }}
      />
    </div>
  );
}
