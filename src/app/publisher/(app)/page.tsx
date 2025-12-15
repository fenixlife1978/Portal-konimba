'use client';

import { DashboardCard } from '@/components/dashboard-card';
import { 
  IconPending,
  IconHistory,
  IconReceipt,
  IconPerformance,
  IconSettings
} from '@/components/custom-icons';

export default function PublisherDashboardPage() {
  const menuItems = [
    { title: "Pagos Pendientes", description: "Consulta los pagos que están por ser procesados.", href: "/publisher/pending-payments", icon: <IconPending />, color: "bg-chart-1" },
    { title: "Pagos Históricos", description: "Revisa tu historial completo de pagos.", href: "/publisher/history", icon: <IconHistory />, color: "bg-chart-2" },
    { title: "Mis Recibos", description: "Accede y descarga tus recibos de pago.", href: "/publisher/receipts", icon: <IconReceipt />, color: "bg-chart-3" },
    { title: "Mi Reporte", description: "Monitorea tu rendimiento actual.", href: "/publisher/performance", icon: <IconPerformance />, color: "bg-chart-4" },
    { title: "Configuración", description: "Ajusta la configuración de tu cuenta y notificaciones.", href: "/publisher/settings", icon: <IconSettings />, color: "bg-chart-5" },
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
