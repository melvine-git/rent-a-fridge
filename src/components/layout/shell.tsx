'use client';

import { useEffect, useState } from 'react';
import { TopBar } from './top-bar';
import { Sidebar } from './sidebar';
import { CommandMenu } from './command-menu';
import { NotificationsPanel } from './notifications-panel';
import { Toaster } from '@/components/ui/sonner';
import type { ShellData } from '@/types';

export function Shell({ children, data }: { children: React.ReactNode; data: ShellData }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} counts={data.counts} />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
          onNotificationsClick={() => setNotificationsOpen(true)}
          notificationCount={data.notifications.length}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} index={data.searchIndex} />
      <NotificationsPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} notifications={data.notifications} />
      <Toaster
        position="bottom-right"
        richColors
        toastOptions={{ style: { borderRadius: '0.625rem', boxShadow: 'var(--shadow-lg)' } }}
      />
    </div>
  );
}
