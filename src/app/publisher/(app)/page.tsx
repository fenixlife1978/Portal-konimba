'use client';

import { DashboardCard } from '@/components/dashboard-card';
import { 
  IconReceipt,
  IconPerformance,
  IconSettings
} from '@/components/custom-icons';

export default function PublisherDashboardPage() {
  const menuItems = [
    { title: "Mis Recibos", description: "Accede y descarga tus recibos de pago.", href: "/publisher/receipts", icon: <IconReceipt className="h-full w-full" />, color: "bg-chart-3" },
    { title: "Mi Reporte", description: "Monitorea tu rendimiento actual.", href: "/publisher/performance", icon: <IconPerformance className="h-full w-full" />, color: "bg-chart-4" },
    { title: "Configuración", description: "Ajusta la configuración de tu cuenta y notificaciones.", href: "/publisher/settings", icon: <IconSettings className="h-full w-full" />, color: "bg-chart-5" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline text-foreground mb-8">Panel de Publisher</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {menuItems.map((item, index) => (
           <div key={item.title} className="animate-in fade-in-0 slide-in-from-top-4 duration-500" style={{ animationDelay: `${index * 100}ms`}}>
            <DashboardCard 
              href={item.href}
              icon={item.icon}
              title={item.title}
              description={item.description}
              colorClass={item.color}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
