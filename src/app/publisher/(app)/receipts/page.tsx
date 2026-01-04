'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc, useUser, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Search, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportToPDF } from '@/lib/export-pdf';

// Types
type Payment = {
  id: string;
  paymentPeriod: string; // e.g., '2024-07-fortnight-1'
  amountUSD: number;
  status: 'pending' | 'paid';
  paidAt: Timestamp;
};
type CompanySettings = { companyName?: string; };
type Publisher = { firstName: string; lastName: string; };

// Date options for forms
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];

// Schemas
const periodSchema = z.object({
  month: z.string().nonempty(),
  year: z.string().nonempty(),
  period: z.enum(['all', 'fortnight-1', 'fortnight-2']),
});
type PeriodFormData = z.infer<typeof periodSchema>;

const rangeSchema = z.object({
  startMonth: z.string().nonempty(),
  startYear: z.string().nonempty(),
  endMonth: z.string().nonempty(),
  endYear: z.string().nonempty(),
}).refine(data => {
    const startDate = new Date(parseInt(data.startYear), parseInt(data.startMonth) - 1);
    const endDate = new Date(parseInt(data.endYear), parseInt(data.endMonth) - 1);
    return endDate >= startDate;
}, { message: "La fecha de fin debe ser posterior a la fecha de inicio.", path: ["endYear"] });
type RangeFormData = z.infer<typeof rangeSchema>;


// Main Component
export default function PublisherReceiptsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentQueryDesc, setCurrentQueryDesc] = useState('');

  const { control: periodControl, handleSubmit: handlePeriodSubmit } = useForm<PeriodFormData>({ resolver: zodResolver(periodSchema) });
  const { control: rangeControl, handleSubmit: handleRangeSubmit } = useForm<RangeFormData>({ resolver: zodResolver(rangeSchema) });
  
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);
  
  const publisherRef = useMemo(() => (user && firestore) ? doc(firestore, 'publishers', user.uid) : null, [user, firestore]);
  const { data: publisherData } = useDoc<Publisher>(publisherRef);

  const fetchPayments = async (q: Query) => {
    setIsLoading(true);
    setPayments(null);
    try {
        const querySnapshot = await getDocs(q);
        const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setPayments(results);
        if (results.length === 0) {
            toast({ title: "Sin Resultados", description: "No se encontraron pagos para el período seleccionado." });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error al consultar", description: error.message });
    } finally {
        setIsLoading(false);
    }
  }

  const onPeriodSubmit = (data: PeriodFormData) => {
    if (!user || !firestore) return;
    const { year, month, period } = data;
    
    let baseQuery = query(collection(firestore, "payments"), 
        where("publisherId", "==", user.uid),
        where("status", "==", "paid")
    );

    const monthLabel = months.find(m => m.value === month)?.label;
    
    if (period === 'all') {
        const periodPrefix = `${year}-${month}`;
        baseQuery = query(baseQuery, 
            where('paymentPeriod', '>=', periodPrefix),
            where('paymentPeriod', '<', `${year}-${parseInt(month) + 1}`)
        );
        setCurrentQueryDesc(`Mes de ${monthLabel} ${year}`);
    } else {
        const periodId = `${year}-${month}-${period}`;
        baseQuery = query(baseQuery, where('paymentPeriod', '==', periodId));
        const periodLabel = period === 'fortnight-1' ? '1ra quincena' : '2da quincena';
        setCurrentQueryDesc(`${periodLabel} de ${monthLabel} ${year}`);
    }

    fetchPayments(query(baseQuery, orderBy('paidAt', 'desc')));
  };

  const onRangeSubmit = (data: RangeFormData) => {
    if (!user || !firestore) return;
    const { startYear, startMonth, endYear, endMonth } = data;

    const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
    const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1 + 1, 0); // End of the selected month
    
    let q = query(collection(firestore, "payments"), 
        where("publisherId", "==", user.uid),
        where("status", "==", "paid"),
        where("paidAt", ">=", startDate),
        where("paidAt", "<=", endDate),
        orderBy('paidAt', 'desc')
    );
    
    const startMonthLabel = months.find(m => m.value === startMonth)?.label;
    const endMonthLabel = months.find(m => m.value === endMonth)?.label;
    setCurrentQueryDesc(`Desde ${startMonthLabel} ${startYear} hasta ${endMonthLabel} ${endYear}`);
    fetchPayments(q);
  };
  
  const formatPaymentPeriod = (period: string) => {
    if (!period) return '';
    const parts = period.split('-');
    const year = parts[0];
    const month = months.find(m => m.value === parts[1])?.label;
    const fortnight = period.endsWith('fortnight-1') ? '1ra quincena' : '2da quincena';
    return `${month} ${year} - ${fortnight}`;
  };
  
  const totalAmount = useMemo(() => {
    return payments?.reduce((sum, p) => sum + p.amountUSD, 0) || 0;
  }, [payments]);

  const handleExportGeneral = async () => {
    if (!payments || payments.length === 0) return;
    setIsExporting(true);

    const reportTitle = `Reporte de Pagos - ${currentQueryDesc}`;
    const fileName = `Reporte_Pagos_${publisherData?.lastName}_${currentQueryDesc.replace(/ /g, '_')}.pdf`;

    const head = [['Período de Pago', 'Monto (USD)', 'Fecha de Pago']];
    const body = payments.map(p => [
        formatPaymentPeriod(p.paymentPeriod),
        `$${p.amountUSD.toFixed(2)}`,
        p.paidAt ? p.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A',
    ]);
    const foot = [[{ content: 'TOTAL', colSpan: 1, styles: { fontStyle: 'bold', halign: 'right' } }, { content: `$${totalAmount.toFixed(2)}`, styles: { fontStyle: 'bold' }}, '']];

    await exportToPDF({ head, body, foot, fileName, reportTitle, companyName: settingsData?.companyName, publisherName: `${publisherData?.firstName} ${publisherData?.lastName}` });

    setIsExporting(false);
  }
  
  const handleExportSingle = async (payment: Payment) => {
     // TODO: Implement single receipt PDF export
     toast({title: "Función no implementada", description: "La exportación de recibos individuales aún está en desarrollo."})
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Mis Pagos Históricos</h1>
        <Button asChild variant="outline">
          <Link href="/publisher"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consultar Pagos</CardTitle>
          <CardDescription>Usa los filtros para encontrar los pagos que has recibido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="period">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="period">Filtro por Período</TabsTrigger>
              <TabsTrigger value="range">Filtro por Rango</TabsTrigger>
            </TabsList>
            <TabsContent value="period">
              <form onSubmit={handlePeriodSubmit(onPeriodSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Period Form */}
                    <div className="space-y-2">
                        <Label>Año</Label>
                        <Controller name="year" control={periodControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={String(currentYear)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                        )} />
                    </div>
                     <div className="space-y-2">
                        <Label>Mes</Label>
                        <Controller name="month" control={periodControl} render={({ field }) => (
                            <Select onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Selecciona un mes"/></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                        )} />
                    </div>
                     <div className="space-y-2">
                        <Label>Quincena</Label>
                        <Controller name="period" control={periodControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue="all"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                                <SelectItem value="all">Mes Completo</SelectItem>
                                <SelectItem value="fortnight-1">1ra Quincena</SelectItem>
                                <SelectItem value="fortnight-2">2da Quincena</SelectItem>
                            </SelectContent></Select>
                        )} />
                    </div>
                </div>
                <Button type="submit" disabled={isLoading}><Search className="mr-2 h-4 w-4"/>Consultar por Período</Button>
              </form>
            </TabsContent>
            <TabsContent value="range">
               <form onSubmit={handleRangeSubmit(onRangeSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Range Form */}
                  <div className="space-y-2">
                    <Label>Desde Mes</Label>
                    <Controller name="startMonth" control={rangeControl} render={({ field }) => (<Select onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Mes"/></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Desde Año</Label>
                    <Controller name="startYear" control={rangeControl} render={({ field }) => (<Select onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Año"/></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hasta Mes</Label>
                    <Controller name="endMonth" control={rangeControl} render={({ field }) => (<Select onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Mes"/></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hasta Año</Label>
                    <Controller name="endYear" control={rangeControl} render={({ field }) => (<Select onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Año"/></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>)} />
                  </div>
                </div>
                <Button type="submit" disabled={isLoading}><Search className="mr-2 h-4 w-4"/>Consultar por Rango</Button>
               </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {isLoading && (
        <div className="flex items-center justify-center pt-16">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p className="text-lg">Buscando pagos...</p>
        </div>
      )}

      {payments && (
        <Card className="mt-8">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Resultados de la Búsqueda</CardTitle>
                        <CardDescription>{payments.length} pago(s) encontrado(s) para: {currentQueryDesc}</CardDescription>
                    </div>
                     <Button variant="outline" onClick={handleExportGeneral} disabled={isExporting || payments.length === 0}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                        Exportar PDF General
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Período de Pago</TableHead>
                            <TableHead className="text-right">Monto (USD)</TableHead>
                            <TableHead className="text-center">Fecha de Pago</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {payments.length === 0 ? (
                           <TableRow>
                               <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                   No hay pagos registrados para el período seleccionado.
                               </TableCell>
                           </TableRow>
                       ) : (
                           payments.map(payment => (
                               <TableRow key={payment.id}>
                                   <TableCell className="font-medium">{formatPaymentPeriod(payment.paymentPeriod)}</TableCell>
                                   <TableCell className="text-right font-mono">${payment.amountUSD.toFixed(2)}</TableCell>
                                   <TableCell className="text-center">{payment.paidAt ? payment.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'}</TableCell>
                                   <TableCell className="text-right">
                                       <Button variant="ghost" size="sm" onClick={() => handleExportSingle(payment)}>Exportar Recibo</Button>
                                   </TableCell>
                               </TableRow>
                           ))
                       )}
                    </TableBody>
                    {payments.length > 0 && (
                        <TableFooter>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableCell className="font-bold">TOTAL</TableCell>
                                <TableCell className="text-right font-bold text-lg">${totalAmount.toFixed(2)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </CardContent>
        </Card>
      )}

    </div>
  );
}
