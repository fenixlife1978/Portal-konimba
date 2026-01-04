'use client';
import { useMemo } from 'react';
import { useCollection, useUser, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, where, doc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  DollarSign,
  History,
  ArrowRight
} from 'lucide-react';
import {
  IconPerformance,
  IconSettings,
} from '@/components/custom-icons';

// Types
type Publisher = {
  firstName: string;
  lastName: string;
};
type Payment = {
  amountUSD: number;
  paidAt: { toDate: () => Date };
};
type Lead = {
  offerId: string;
  quantity: number;
};
type Offer = {
  id: string;
  name: string;
};

const StatCard = ({ title, value, icon, description }: { title: string; value: string | number; icon: React.ReactNode; description?: string }) => (
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

export default function PublisherDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = db;

  // Data fetching
  const publisherRef = useMemo(() => (user ? doc(firestore, 'publishers', user.uid) : null), [user]);
  const { data: publisherData, isLoading: isPublisherLoading } = useDoc<Publisher>(publisherRef);

  const paymentsQuery = useMemo(() => (user ? query(collection(firestore, 'payments'), where('publisherId', '==', user.uid), where('status', '==', 'paid')) : null), [user]);
  const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);
  
  const leadsQuery = useMemo(() => (user ? query(collection(firestore, 'leads'), where('publisherId', '==', user.uid)) : null), [user]);
  const { data: leads, isLoading: isLoadingLeads } = useCollection<Lead>(leadsQuery);

  const offersRef = useMemo(() => (firestore && user ? collection(firestore, 'offers') : null), [firestore, user]);
  const { data: offers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);


  const memoizedStats = useMemo(() => {
    if (!payments || !leads || !offers) {
      return {
        totalEarnings: 0,
        monthEarnings: 0,
        leadsByOfferData: [],
      };
    }

    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amountUSD, 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthEarnings = payments
      .filter(p => {
        if (!p.paidAt) return false;
        const paidDate = p.paidAt.toDate();
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      })
      .reduce((sum, payment) => sum + payment.amountUSD, 0);

    const offersMap = new Map(offers.map((o) => [o.id, o.name]));
    const leadsByOffer = new Map<string, number>();

    leads.forEach(lead => {
      const offerName = offersMap.get(lead.offerId) || 'Oferta Desconocida';
      leadsByOffer.set(offerName, (leadsByOffer.get(offerName) || 0) + lead.quantity);
    });

    const leadsByOfferData = Array.from(leadsByOffer.entries())
      .map(([name, leads]) => ({ name, leads }))
      .sort((a, b) => b.leads - a.leads);
      
    return { totalEarnings, monthEarnings, leadsByOfferData };
  }, [payments, leads, offers]);
  
  const isLoading = isUserLoading || isPublisherLoading || isLoadingPayments || isLoadingLeads || isLoadingOffers;
  const publisherName = publisherData ? `${publisherData.firstName} ${publisherData.lastName}` : 'Cargando...';

  const menuItems = [
    { title: 'Mi Reporte', href: '/publisher/performance', icon: <IconPerformance className="h-full w-full" /> },
    { title: 'Configuración', href: '/publisher/settings', icon: <IconSettings className="h-full w-full" /> },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold font-headline text-foreground">
        Hola Publisher, {publisherName}
      </h1>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ganancias Históricas" value={isLoading ? '...' : `$${memoizedStats.totalEarnings.toFixed(2)}`} icon={<History className="h-4 w-4 text-muted-foreground" />} description="Total de todos los pagos recibidos." />
        <StatCard title="Ganancias (Mes Actual)" value={isLoading ? '...' : `$${memoizedStats.monthEarnings.toFixed(2)}`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} description="Pagos recibidos en el mes en curso." />
      </div>

       {/* Charts and Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Rendimiento Histórico de Ofertas</CardTitle>
            <CardDescription>Cantidad de leads generados por cada oferta.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={memoizedStats.leadsByOfferData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
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
              <CardDescription>Accesos directos a otras secciones.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {menuItems.map((item) => (
                <Button
                  asChild
                  key={item.title}
                  variant="outline"
                  className="w-full justify-start gap-3 text-base py-6 h-auto"
                >
                  <Link href={item.href}>
                    <div className="h-12 w-12 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <span className="flex-1 text-left">{item.title}</span>
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
