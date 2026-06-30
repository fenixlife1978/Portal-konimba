'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { useAuth, useDoc, useFirestore, useUser } from '@/firebase';
import { db } from '@/firebase/config';
import { doc, collection, getDocs, writeBatch } from 'firebase/firestore';
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
  const { user } = useUser();
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const settingsRef = useMemo(
    () => (firestore ? doc(firestore, 'settings', 'company') : null),
    [firestore]
  );
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  const handleResetApp = async () => {
    if (!firestore) return;
    setIsResetting(true);

    try {
      // Colecciones a resetear (Borrar toda la data excepto usuarios y publishers)
      const collectionsToReset = ['leads', 'offers', 'payments', 'settings'];
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
        description: `Se han eliminado ${totalDeleted} registros operativos con éxito.` 
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

            {/* Reset Button in Header (Requested position) */}
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
                      <AlertDialogDescription className="text-base">
                        Esta acción es irreversible y eliminará permanentemente todos los:
                        <ul className="list-disc list-inside mt-2 space-y-1 font-semibold text-foreground">
                          <li>Registros de Leads</li>
                          <li>Catálogo de Ofertas</li>
                          <li>Historial de Pagos</li>
                          <li>Configuración Corporativa</li>
                        </ul>
                        <br />
                        <span className="text-emerald-600 font-bold">IMPORTANTE: Los usuarios (Trabajadores y Admins) NO serán eliminados.</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetApp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl px-6">
                        {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Confirmar Borrado Total
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
