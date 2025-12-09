import { DashboardCard } from '@/components/dashboard-card';
import { 
  IconPublisher,
  IconLead,
  IconPayment,
  IconOffer,
  IconReport,
  IconReceipt
} from '@/components/custom-icons';

export default function AdminDashboardPage() {
  const menuItems = [
    { title: "Gestión de Publishers", description: "Administra y visualiza tus publishers.", href: "/admin/publishers", icon: <IconPublisher />, color: "hover:border-chart-1" },
    { title: "Gestión de Leads", description: "Revisa y gestiona los leads generados.", href: "/admin/leads", icon: <IconLead />, color: "hover:border-chart-2" },
    { title: "Gestión de Pagos", description: "Procesa y consulta los pagos a publishers.", href: "/admin/payments", icon: <IconPayment />, color: "hover:border-chart-3" },
    { title: "Gestión de Ofertas", description: "Crea y administra las ofertas disponibles.", href: "/admin/offers", icon: <IconOffer />, color: "hover:border-chart-4" },
    { title: "Reportes", description: "Genera reportes de rendimiento y finanzas.", href: "/admin/reports", icon: <IconReport />, color: "hover:border-chart-5" },
    { title: "Recibos", description: "Consulta y gestiona los recibos de pago.", href: "/admin/receipts", icon: <IconReceipt />, color: "hover:border-chart-1" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline text-foreground mb-8">Panel de Administrador</h1>
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
