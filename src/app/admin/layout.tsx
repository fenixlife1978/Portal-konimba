import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Logo className="h-10 w-10" />
            <span className="text-xl font-bold font-headline text-foreground hidden sm:inline">
              Siren's Portal
            </span>
          </Link>

          <Button asChild variant="ghost">
            <Link href="/" >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
