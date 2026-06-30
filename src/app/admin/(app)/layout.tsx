'use client';

import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { useAuth, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { Separator } from '@/components/ui/separator';

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const firestore = db;
  const settingsRef = useMemo(
    () => (firestore ? doc(firestore, 'settings', 'company') : null),
    [firestore]
  );
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background/95">
        <AdminSidebar companyName={settingsData?.companyName} logoUrl={settingsData?.logoUrl} />
        <SidebarInset className="flex flex-col bg-background/50">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
            <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-muted-foreground">Panel de Control</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 pt-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
