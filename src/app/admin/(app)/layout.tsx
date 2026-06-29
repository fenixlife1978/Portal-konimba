'use client';

import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { useAuth, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';

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
