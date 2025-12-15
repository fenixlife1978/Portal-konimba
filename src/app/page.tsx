'use client';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { ArrowRight } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';


type CompanySettings = {
  companyName?: string;
};

export default function Home() {
  const firestore = useFirestore();
  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <header className="mb-12">
        <div className="inline-block mb-4 animate-in fade-in zoom-in-95 duration-500">
          <Logo />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-top-4 duration-700 delay-200">
            <h1 className="text-4xl md:text-5xl font-bold font-headline text-foreground">
              {settingsData?.companyName ? settingsData.companyName.split(' ')[0] : "Portal"}
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold font-headline text-foreground/80">
              {settingsData?.companyName ? settingsData.companyName.substring(settingsData.companyName.indexOf(' ') + 1) : "Konimba Group Marketing"}
            </h2>
          </div>
        <p className="mt-2 text-lg text-muted-foreground animate-in fade-in-0 slide-in-from-top-4 duration-700 delay-300">
          Bienvenido al portal para administradores y publishers.
        </p>
      </header>
      
      <main className="w-full max-w-4xl animate-in fade-in-0 slide-in-from-top-4 duration-700 delay-400">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <DashboardLink
            href="/admin/login"
            title="Panel de Administrador"
            description="Gestiona publishers, leads, pagos y más."
          />
          <DashboardLink
            href="/publisher/login"
            title="Panel de Publisher"
            description="Consulta tu rendimiento, pagos y configuración."
          />
        </div>
      </main>

      <footer className="mt-12 text-sm text-muted-foreground animate-in fade-in-0 duration-500 delay-500">
        <p>&copy; {new Date().getFullYear()} Portal Konimba. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

function DashboardLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-all duration-300 ease-in-out bg-card/80 backdrop-blur-sm group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-left">
              <CardTitle className="text-2xl font-headline text-foreground">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
