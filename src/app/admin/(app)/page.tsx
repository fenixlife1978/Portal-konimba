'use client';
import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Users, 
  Target, 
  BarChart3, 
  DollarSign, 
  ArrowRight,
} from 'lucide-react';
import {
  IconPublisher,
  IconLead,
  IconPayment,
  IconOffer,
  IconReport,
  IconReceipt as IconReceiptCustom,
  IconSettings,
} from '@/components/custom-icons';


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
  const { user } = useUser();
  
  // Data fetching
  const publishersRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'publishers') : null, [firestore, user]);
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
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const totalPublishers = publishers.length;

    const fortnightStartDay = currentDay <= 15 ? 1 : 16;
    const fortnightEndDay = currentDay <= 15 ? 15 : new Date(currentYear, currentMonth, 0).getDate();
    
    const startDateFortnight = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(fortnightStartDay).padStart(2, '0')}`;
    const endDateFortnight = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(fortnightEndDay).padStart(2, '0')}`;

    const leadsThisFortnight = leads.filter(lead => lead.date >= startDateFortnight && lead.date <= endDateFortnight);
    const activePublishersThisFortnight = new Set(leadsThisFortnight.map(l => l.publisherId)).size;
    
    const startDateMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDateMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;
    const leadsThisMonth = leads.filter(lead => lead.date >= startDateMonth && lead.date <= endDateMonth);

    const totalLeadsThisMonth = leadsThisMonth.reduce((sum, lead) => sum + lead.quantity, 0);

    const offersMap = new Map(offers.map(o => [o.id, o]));
    const totalEarningsThisMonth = leadsThisMonth.reduce((sum, lead) => {
        const offer = offersMap.get(lead.offerId);
        return sum + (lead.quantity * (offer?.paymentAmount || 0));
    }, 0);

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
    { title: "Gestión de Publishers", href: "/admin/publishers", icon: <IconPublisher /> },
    { title: "Cargar Leads", href: "/admin/leads", icon: <IconLead /> },
    { title: "Gestión de Pagos", href: "/admin/payments", icon: <IconPayment /> },
    { title: "Gestión de Ofertas", href: "/admin/offers", icon: <IconOffer /> },
    { title: "Reportes", href: "/admin/reports", icon: <IconReport /> },
    { title: "Recibos", href: "/admin/receipts", icon: <IconReceiptCustom /> },
    { title: "Configuración", href: "/admin/settings", icon: <IconSettings /> },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold font-headline text-foreground">Panel de Administrador</h1>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Publishers" value={isLoading ? '...' : memoizedStats.totalPublishers} icon={<Users className="h-4 w-4 text-muted-foreground" />} description="Publishers registrados en total." />
        <StatCard title="Publishers Activos" value={isLoading ? '...' : memoizedStats.activePublishersThisFortnight} icon={<Target className="h-4 w-4 text-muted-foreground" />} description="En la quincena actual." />
        <StatCard title="Total Leads (Mes)" value={isLoading ? '...' : memoizedStats.totalLeadsThisMonth.toLocaleString()} icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} description="Leads generados este mes." />
        <StatCard title="Ganancias (Mes)" value={isLoading ? '...' : `$${memoizedStats.totalEarningsThisMonth.toFixed(2)}`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} description="Ganancias totales este mes." />
      </div>

      {/* Charts and Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Rendimiento de Ofertas</CardTitle>
            <CardDescription>Cantidad de leads generados por cada oferta (histórico).</CardDescription>
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
                <Bar dataKey="leads" fill="hsl(var(--accent))" name="Leads generados" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="col-span-1 flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Navegación</CardTitle>
                    <CardDescription>Accesos directos a las secciones principales.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {menuItems.map((item) => (
                    <Button asChild key={item.title} variant="outline" className="w-full justify-start gap-3 text-base py-6">
                        <Link href={item.href}>
                            <div className="h-10 w-10 -ml-1.5 flex items-center justify-center">
                               {item.icon}
                            </div>
                            {item.title}
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Link>
                    </Button>
                    ))}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
