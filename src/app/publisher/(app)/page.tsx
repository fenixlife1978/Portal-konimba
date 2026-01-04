'use client';
import { useMemo } from 'react';
import { useDoc, useUser } from '@/firebase';
import { db } from '@/firebase/config';
import { doc } from 'firebase/firestore';
import { DashboardCard } from '@/components/dashboard-card';
import { 
  IconReceipt,
  IconPerformance,
  IconSettings
} from '@/components/custom-icons';

type Publisher = {
  firstName: string;
  lastName: string;
};

export default function PublisherDashboardPage() {
  const { user, isUserLoading } = useUser();

  const publisherRef = useMemo(() => (user ? doc(db, 'publishers', user.uid) : null), [user]);
  const { data: publisherData, isLoading: isPublisherLoading } = useDoc<Publisher>(publisherRef);

  const menuItems = [
    { title: "Mi Reporte", description: "Monitorea tu rendimiento actual.", href: "/publisher/performance", icon: <IconPerformance className="h-full w-full" />, color: "bg-chart-4" },
    { title: "Configuración", description: "Ajusta la configuración de tu cuenta y notificaciones.", href: "/publisher/settings", icon: <IconSettings className="h-full w-full" />, color: "bg-chart-5" },
  ];

  const isLoading = isUserLoading || isPublisherLoading;
  const publisherName = publisherData ? `${publisherData.firstName} ${publisherData.lastName}` : '...';

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline text-foreground mb-8">
        Hola Publisher, {isLoading ? '...' : publisherName}
      </h1>
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
