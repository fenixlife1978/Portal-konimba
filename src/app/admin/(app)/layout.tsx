'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useAuth, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const firestore = db;
  const router = useRouter();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/'); // Redirect to home page after logout
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 group">
            <Logo className="h-12 w-12" src={settingsData?.logoUrl} />
            <span className="text-xl font-bold font-headline text-foreground hidden sm:inline">
              {settingsData?.companyName || "Portal Konimba"}
            </span>
          </Link>

          <div className="flex items-center gap-4">
             <Button onClick={handleLogout} variant="ghost">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
