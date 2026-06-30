
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { useAuth, useDoc, useFirestore, useUser } from '@/firebase';
import { doc, collection, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Strict Role Validation
  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.replace('/admin/login');
      } else if (firestore) {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        getDoc(adminRoleRef).then(docSnap => {
          if (docSnap.exists()) {
            setIsAuthorized(true);
          } else {
            // Not an admin, kick out
            auth.signOut().then(() => {
              toast({
                variant: 'destructive',
                title: 'Acceso Denegado',
                description: 'No tienes permisos de administrador para acceder a esta área.'
              });
              router.replace('/admin/login');
            });
          }
        });
      }
    }
  }, [user, isUserLoading, firestore, router, auth, toast]);

  const settingsRef = useMemo(
    () => (firestore ? doc(firestore, 'settings', 'company') : null),
    [firestore]
  );
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  const handleResetApp = async () => {
    if (!firestore) return;
    setIsResetting(true);

    try {
      // Colecciones a resetear (Borrar solo data operativa)
      // IMPORTANTE: Excluimos 'publishers', 'roles_admin' y 'settings'
      const collectionsToReset = ['leads', 'offers', 'payments'];
      let totalDeleted = 0;

      for (const colName of collectionsToReset) {
        const colRef = collection(firestore, colName);
        const snapshot = await getDocs(colRef);
        
        if (!snapshot.empty) {
          const batch = writeBatch(firestore);
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            totalDeleted++;
          });
          await batch.commit();
        }
      }

      toast({ 
        title: "Sistema Reiniciado", 
        description: `Se han eliminado ${totalDeleted} registros operativos con éxito. La configuración se mantuvo intacta.` 
      });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error al reiniciar", 
        description: error.message 
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isUserLoading || !isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Verificando credenciales administrativas...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background/95">
        <AdminSidebar companyName={settingsData?.companyName} logoUrl={settingsData?.logoUrl} />
        <SidebarInset className="flex flex-col bg-background/50">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-muted-foreground">Panel de Control</span>
            </div>

            {/* Reset Button in Header */}
            {mounted && (
              <div className="ml-auto">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="rounded-xl h-9 px-4 shadow-sm">
                      <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isResetting && "animate-spin")} />
                      Reset App
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-2xl font-bold">¿Estás totalmente seguro?</AlertDialogTitle>
                      <AlertDialogDescription className="text-base" asChild>
                        <div className="text-muted-foreground">
                          Esta acción es irreversible y eliminará permanentemente todos los:
                          <ul className="list-disc list-inside mt-2 space-y-1 font-semibold text-foreground">
                            <li>Registros de Leads</li>
                            <li>Catálogo de Ofertas</li>
                            <li>Historial de Pagos</li>
                          </ul>
                          <br />
                          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <span className="text-emerald-600 font-bold text-sm block">NO se eliminarán:</span>
                            <span className="text-emerald-700 text-xs mt-1 block">
                              Usuarios, Configuración del Sistema (Motor, APIs, Tasas), ni Miembros del Equipo.
                            </span>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetApp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl px-6">
                        {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Confirmar Borrado Operativo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
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
