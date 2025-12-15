'use client';
import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardCard } from '@/components/dashboard-card';
import { 
  IconPublisher,
  IconLead,
  IconPayment,
  IconOffer,
  IconReport,
  IconReceipt,
} from '@/components/custom-icons';
import { Users, Target, BarChart3, DollarSign } from 'lucide-react';

// Types
type Publisher = { id: string; };
type Offer = { id: string; name: string; paymentAmount: number; };
type Lead = { publisherId: string; offerId: string; quantity: number; date: string; };

const StatCard = ({ title, value, icon, description }: { title: string, value: string | number, icon: React.ReactNode, description?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  
  // Data fetching
  const publishersRef = useMemoFirebase(() => firestore ? collection(firestore, 'publishers') : null, [firestore]);
  const { data: publishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);

  const offersRef = useMemoFirebase(() => firestore ? collection(firestore, 'offers') : null, [firestore]);
  const { data: offers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);

  const leadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
  const { data: leads, isLoading: isLoadingLeads } = useCollection<Lead>(leadsRef);

  const memoizedStats = useMemo(() => {
    if (!leads || !publishers || !offers) {
      return {
        totalPublishers: 0,
        activePublishersThisFortnight: 0,
        totalLeadsThisMonth: 0,
        totalEarningsThisMonth: 0,
        leadsByOfferData: []
      };
    }
    
    // --- Calculations ---
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // 1. Total Publishers
    const totalPublishers = publishers.length;

    // 2. Active publishers in current fortnight
    const fortnightStartDay = currentDay <= 15 ? 1 : 16;
    const fortnightEndDay = currentDay <= 15 ? 15 : new Date(currentYear, currentMonth, 0).getDate();
    
    const startDateFortnight = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(fortnightStartDay).padStart(2, '0')}`;
    const endDateFortnight = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(fortnightEndDay).padStart(2, '0')}`;

    const leadsThisFortnight = leads.filter(lead => lead.date >= startDateFortnight && lead.date <= endDateFortnight);
    const activePublishersThisFortnight = new Set(leadsThisFortnight.map(l => l.publisherId)).size;
    
    // 3. Leads & Earnings this month
    const startDateMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDateMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;
    const leadsThisMonth = leads.filter(lead => lead.date >= startDateMonth && lead.date <= endDateMonth);

    const totalLeadsThisMonth = leadsThisMonth.reduce((sum, lead) => sum + lead.quantity, 0);

    const offersMap = new Map(offers.map(o => [o.id, o]));
    const totalEarningsThisMonth = leadsThisMonth.reduce((sum, lead) => {
        const offer = offersMap.get(lead.offerId);
        return sum + (lead.quantity * (offer?.paymentAmount || 0));
    }, 0);

    // 4. Bar chart data
    const leadsByOffer = new Map<string, number>();
    leads.forEach(lead => {
        leadsByOffer.set(lead.offerId, (leadsByOffer.get(lead.offerId) || 0) + lead.quantity);
    });

    const leadsByOfferData = Array.from(leadsByOffer.entries()).map(([offerId, quantity]) => ({
      name: offersMap.get(offerId)?.name || 'Oferta Desconocida',
      leads: quantity,
    })).sort((a, b) => b.leads - a.leads);


    return { totalPublishers, activePublishersThisFortnight, totalLeadsThisMonth, totalEarningsThisMonth, leadsByOfferData };
  }, [leads, publishers, offers]);
  
  const isLoading = isLoadingPublishers || isLoadingOffers || isLoadingLeads;

  const menuItems = [
    { title: "Gestión de Publishers", description: "Administra y visualiza tus publishers.", href: "/admin/publishers", icon: <IconPublisher />, color: "bg-chart-1" },
    { title: "Cargar Leads", description: "Revisa y gestiona los leads generados.", href: "/admin/leads", icon: <IconLead />, color: "bg-chart-2" },
    { title: "Gestión de Pagos", description: "Procesa y consulta los pagos a publishers.", href: "/admin/payments", icon: <IconPayment />, color: "bg-chart-3" },
    { title: "Gestión de Ofertas", description: "Crea y administra las ofertas disponibles.", href: "/admin/offers", icon: <IconOffer />, color: "bg-chart-4" },
    { title: "Reportes", description: "Genera reportes de rendimiento y finanzas.", href: "/admin/reports", icon: <IconReport />, color: "bg-chart-5" },
    { title: "Recibos", description: "Consulta y gestiona los recibos de pago.", href: "/admin/receipts", icon: <IconReceipt />, color: "bg-chart-1" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline text-foreground mb-8">Panel de Administrador</h1>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total de Publishers" value={isLoading ? '...' : memoizedStats.totalPublishers} icon={<Users className="h-4 w-4 text-muted-foreground" />} description="Publishers registrados en total." />
        <StatCard title="Publishers Activos" value={isLoading ? '...' : memoizedStats.activePublishersThisFortnight} icon={<Target className="h-4 w-4 text-muted-foreground" />} description="En la quincena actual." />
        <StatCard title="Total Leads (Mes)" value={isLoading ? '...' : memoizedStats.totalLeadsThisMonth.toLocaleString()} icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} description="Leads generados este mes." />
        <StatCard title="Ganancias (Mes)" value={isLoading ? '...' : `$${memoizedStats.totalEarningsThisMonth.toFixed(2)}`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} description="Ganancias totales este mes." />
      </div>

      {/* Charts and other widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Rendimiento de Ofertas</CardTitle>
            <CardDescription>Cantidad de leads generados por cada oferta.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={memoizedStats.leadsByOfferData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))'
                  }}
                />
                <Legend />
                <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads generados" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
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
