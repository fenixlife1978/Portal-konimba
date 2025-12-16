import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  colorClass: string;
}

export function DashboardCard({ href, icon, title, description, colorClass }: DashboardCardProps) {
  return (
    <Link href={href} className="group h-full">
      <Card className={`h-full overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-2xl group-hover:-translate-y-2 border-2 text-primary-foreground border-transparent ${colorClass}`}>
        <CardHeader className="pb-4">
          <div className="mb-4 h-24 w-24 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
          <CardTitle className="text-xl font-headline text-primary-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-primary-foreground/80 text-sm">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
