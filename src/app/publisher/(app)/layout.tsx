'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LogOut, MailCheck, ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function PublisherAppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = db;
  const router = useRouter();
  const { toast } = useToast();
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/publisher/login');
    }
  }, [user, isUserLoading, router]);

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  const handleSendVerificationEmail = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se ha encontrado el usuario.' });
      return;
    }
    setIsSendingVerification(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: 'Correo enviado',
        description: 'Se ha enviado un nuevo correo de verificación. Revisa tu bandeja de entrada (y la carpeta de spam).',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar correo',
        description: error.message || 'No se pudo enviar el correo de verificación.',
      });
    } finally {
      setIsSendingVerification(false);
    }
  };


  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p>Cargando...</p>
      </div>
    );
  }

  // If there's no user, the useEffect will trigger a redirect, so we can render null or a loading spinner briefly.
  // This prevents the layout from flashing while the redirect happens.
  if (!user) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/publisher" className="flex items-center gap-3 group">
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

      {!user.emailVerified && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-500/50">
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
             <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">
                Tu correo electrónico no está verificado.
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={handleSendVerificationEmail} 
              disabled={isSendingVerification}
              className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
            >
              <MailCheck className="mr-2 h-4 w-4" />
              {isSendingVerification ? 'Enviando...' : 'Reenviar correo de verificación'}
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
