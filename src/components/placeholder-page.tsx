import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  backUrl: string;
}

export function PlaceholderPage({ title, backUrl }: PlaceholderPageProps) {
  return (
    <div className="text-center flex flex-col items-center justify-center pt-16">
      <h1 className="text-4xl font-bold font-headline text-foreground mb-4">{title}</h1>
      <p className="text-lg text-muted-foreground mb-8">Esta sección está en construcción.</p>
      <Button asChild>
        <Link href={backUrl}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Link>
      </Button>
    </div>
  );
}
