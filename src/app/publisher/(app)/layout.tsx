
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LogOut, MailCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { db } from '@/firebase/config';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function PublisherAppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push('/publisher/login');
      } else if (firestore) {
        // Check if user is an admin - Admins should not be in the publisher area
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        getDoc(adminRoleRef).then(docSnap => {
          if (docSnap.exists()) {
            // It's an admin, redirect to admin portal
            toast({
              variant: 'destructive',
              title: 'Acceso Restringido',
              description: 'Como administrador, debes usar el portal dedicado.'
            });
            router.push('/admin');
          } else {
            setIsAuthorized(true);
          }
        });
      }
    }
  }, [user, isUserLoading, router, firestore, toast]);

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
        description: 'Se ha enviado un nuevo correo de verificación. Revisa tu bandeja de entrada.',
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


  if (isUserLoading || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground font-medium">Validando acceso al portal de equipo...</p>
      </div>
    );
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

      {!user?.emailVerified && (
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
