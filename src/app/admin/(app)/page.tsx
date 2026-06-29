'use client';
import { useMemo } from 'react';
import { useCollection, useUser } from '@/firebase';
import { db } from '@/firebase/config';
import { collection } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Users, 
  Target, 
  BarChart3, 
  DollarSign, 
  CheckCircle2,
  Signal,
  TrendingUp
} from 'lucide-react';

// Types
type Publisher = { id: string };
type Offer = { id: string; name: string; paymentAmount: number };
type Lead = { publisherId: string; offerId: string; quantity: number; date: string };

const KPIStore = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  color = "primary" 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  description?: string;
  trend?: string;
  color?: string;
}) => (
  <Card className="border-none bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn(
          "p-3 rounded-2xl",
          color === "primary" ? "bg-primary/10 text-primary" : 
          color === "success" ? "bg-emerald-500/10 text-emerald-500" : 
          "bg-amber-500/10 text-amber-500"
        )}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {description && <p className="text-xs text-muted-foreground font-medium">{description}</p>}
      </div>
    </CardContent>
  </Card>
);

import { cn } from '@/lib/utils';

export default function AdminDashboardPage() {
  const firestore = db;
  const { user, isUserLoading } = useUser();

  // Data fetching
  const publishersRef = useMemo(() => (firestore && user ? collection(firestore, 'publishers') : null), [firestore, user]);
  const { data: publishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);

  const offersRef = useMemo(() => (firestore && user ? collection(firestore, 'offers') : null), [firestore, user]);
  const { data: offers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);

  const leadsRef = useMemo(() => (firestore && user ? collection(firestore, 'leads') : null), [firestore, user]);
  const { data: leads, isLoading: isLoadingLeads } = useCollection<Lead>(leadsRef);

  const stats = useMemo(() => {
    if (!leads || !publishers || !offers) return {
      totalPublishers: 0,
      activeFortnight: 0,
      leadsMonth: 0,
      earningsMonth: 0,
      chartData: []
    };

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const startDateMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthLeads = leads.filter(l => l.date >= startDateMonth);
    
    const offersMap = new Map(offers.map(o => [o.id, o]));
    const totalEarnings = monthLeads.reduce((acc, l) => acc + (l.quantity * (offersMap.get(l.offerId)?.paymentAmount || 0)), 0);

    const leadsByOffer = new Map<string, number>();
    leads.forEach(l => {
      const name = offersMap.get(l.offerId)?.name || 'Oferta';
      leadsByOffer.set(name, (leadsByOffer.get(name) || 0) + l.quantity);
    });

    const chartData = Array.from(leadsByOffer.entries())
      .map(([name, leads]) => ({ name, leads }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    return {
      totalPublishers: publishers.length,
      activeFortnight: new Set(monthLeads.map(l => l.publisherId)).size,
      leadsMonth: monthLeads.reduce((acc, l) => acc + l.quantity, 0),
      earningsMonth: totalEarnings,
      chartData
    };
  }, [leads, publishers, offers]);

  const isLoading = isLoadingPublishers || isLoadingOffers || isLoadingLeads || isUserLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          Panel de Control
        </h1>
        <p className="text-muted-foreground font-medium">
          Bienvenido de nuevo, {user?.displayName || 'Administrador'}. Aquí tienes el resumen de hoy.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPIStore 
          title="Equipo Total" 
          value={isLoading ? '...' : stats.totalPublishers} 
          icon={Users} 
          description="Trabajadores registrados"
          trend="+2 este mes"
        />
        <KPIStore 
          title="Activos (Quincena)" 
          value={isLoading ? '...' : stats.activeFortnight} 
          icon={CheckCircle2} 
          color="success"
          description="Generando leads"
        />
        <KPIStore 
          title="Leads del Mes" 
          value={isLoading ? '...' : stats.leadsMonth.toLocaleString()} 
          icon={BarChart3} 
          trend="12%"
        />
        <KPIStore 
          title="Gastos Nómina" 
          value={isLoading ? '...' : `$${stats.earningsMonth.toLocaleString()}`} 
          icon={DollarSign} 
          color="warning"
          description="Proyección acumulada"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Connection Status */}
        <Card className="rounded-2xl border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Estado del Sistema</CardTitle>
            <CardDescription>Monitor de conexiones en tiempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <Signal className="h-5 w-5 text-emerald-500" />
                <span className="font-semibold text-emerald-700">Base de Datos</span>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-emerald-500" />
                <span className="font-semibold text-emerald-700">WhatsApp Gateway</span>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-amber-700">API Cpamerchant</span>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card className="lg:col-span-2 rounded-2xl border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Ingresos por Oferta</CardTitle>
              <CardDescription>Rendimiento quincenal top 5</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pl-2 pb-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 500 }}
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    backgroundColor: 'white'
                  }}
                />
                <Bar 
                  dataKey="leads" 
                  fill="hsl(var(--primary))" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
