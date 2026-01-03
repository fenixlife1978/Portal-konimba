'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { exportToPDF } from '@/lib/export-pdf';


// Types
type Publisher = { id: string; firstName: string; lastName: string; email: string; paymentMethod?: string; country?: string; };
type CompanySettings = { usdToVesRate?: number; usdToCopRate?: number; companyName?: string };
type Offer = { id: string; name: string; paymentAmount: number; };
type Lead = { 
  id: string; 
  publisherId: string;
  publisherName: string;
  offerId: string; 
  offerName: string;
  date: string; // YYYY-MM-DD
  quantity: number; 
  createdAt: Timestamp;
};

// Schema
const reportSchema = z.object({
    period: z.enum(['monthly', 'fortnight-1', 'fortnight-2']),
    month: z.string().nonempty("El mes es requerido."),
    year: z.string().nonempty("El año es requerido."),
});
type ReportFormData = z.infer<typeof reportSchema>;

type ReportData = {
  leads: Lead[];
  offersMap: Map<string, Offer>;
  daysInPeriod: number[];
  periodLabel: string;
}

// Date constants
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];
const periodOptions = [
    { value: 'monthly', label: 'Mes Completo' },
    { value: 'fortnight-1', label: '1ra Quincena' },
    { value: 'fortnight-2', label: '2da Quincena' },
];

const processReport = (reportData: ReportData | null) => {
    if (!reportData) return null;

    const { leads, offersMap, daysInPeriod } = reportData;

    const leadsByOffer = new Map<string, { offerName: string, days: Map<number, number> }>();
    leads.forEach(lead => {
        const day = parseInt(lead.date.split('-')[2]);
        if (!leadsByOffer.has(lead.offerId)) {
            leadsByOffer.set(lead.offerId, { offerName: lead.offerName || 'Oferta Desconocida', days: new Map() });
        }
        const offerEntry = leadsByOffer.get(lead.offerId)!;
        offerEntry.days.set(day, (offerEntry.days.get(day) || 0) + lead.quantity);
    });

    let totalLeads = 0;
    let totalEarnings = 0;

    const tableRows = Array.from(leadsByOffer.entries()).map(([offerId, data]) => {
        const offer = offersMap.get(offerId);
        const offerPayment = offer?.paymentAmount || 0;
        const totalOfferLeads = Array.from(data.days.values()).reduce((sum, qty) => sum + qty, 0);
        const offerEarnings = totalOfferLeads * offerPayment;
        totalLeads += totalOfferLeads;
        totalEarnings += offerEarnings;
        
        return {
            ...data,
            offerId,
            totalOfferLeads,
            offerEarnings,
            offerPayment
        };
    });

    return { dayColumns: daysInPeriod, tableRows, totalLeads, totalEarnings };
}


export default function PerformancePage() {
  const firestore = db;
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const { control, handleSubmit, formState: { errors } } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
     defaultValues: {
      period: 'monthly',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    }
  });

  const publisherRef = useMemo(() => (firestore && user) ? doc(firestore, 'publishers', user.uid) : null, [firestore, user]);
  const { data: publisherData, isLoading: isLoadingPublisher } = useDoc<Publisher>(publisherRef);
  
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);


  const onSubmit = async (data: ReportFormData) => {
    if (!user || !firestore) return;
    setIsGenerating(true);
    setReportData(null);
    
    const { month, year, period } = data;

    let startDay = 1;
    let endDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    let periodLabel = `${months.find(m => m.value === month)?.label} ${year}`;
    let daysInPeriodArray: number[];
    
    if (period === 'fortnight-1') {
        endDay = 15;
        periodLabel = `1ra Quincena - ${periodLabel}`;
    } else if (period === 'fortnight-2') {
        startDay = 16;
        periodLabel = `2da Quincena - ${periodLabel}`;
    }
    
    daysInPeriodArray = Array.from({ length: (endDay - startDay) + 1 }, (_, i) => startDay + i);
    const startDate = `${year}-${month.padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${year}-${month.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    try {
      const leadsQuery = query(
        collection(firestore, 'leads'),
        where('publisherId', '==', user.uid),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );
      const leadsSnapshot = await getDocs(leadsQuery);
      const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));

      if (leads.length === 0) {
        setReportData(null);
        toast({ title: "Sin resultados", description: "No tienes leads registrados para este período." });
        setIsGenerating(false);
        return;
      }

      const offerIds = [...new Set(leads.map(lead => lead.offerId))];
      const offersMap = new Map<string, Offer>();

      if (offerIds.length > 0) {
          const offersQuery = query(collection(firestore, 'offers'), where('__name__', 'in', offerIds));
          const offersSnapshot = await getDocs(offersQuery);
          offersSnapshot.docs.forEach(doc => {
              offersMap.set(doc.id, { id: doc.id, ...doc.data() } as Offer);
          });
      }
      
      setReportData({ leads, offersMap, daysInPeriod: daysInPeriodArray, periodLabel });

    } catch (error: any) {
      console.error("Report Generation Error:", error);
      toast({
        variant: "destructive",
        title: "Error al generar reporte",
        description: error.message || "No se pudieron obtener tus datos de rendimiento.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!reportData || !publisherData) return;
    setIsExporting(true);

    const processed = processReport(reportData);
    if (!processed) {
        setIsExporting(false);
        toast({ variant: 'destructive', title: "Error", description: "No hay datos procesados para exportar."});
        return;
    }
    
    const reportTitle = `Reporte de Rendimiento - ${publisherData.firstName} ${publisherData.lastName}`;
    const fileName = `Reporte_Rendimiento_${publisherData.lastName}_${reportData.periodLabel.replace(' ','_')}.pdf`;

    const head = [["Oferta", ...processed.dayColumns.map(String), "Total Leads", "Precio (USD)", "Ganancia (USD)"]];
    const body = processed.tableRows.map(row => [
        row.offerName,
        ...processed.dayColumns.map(day => row.days.get(day) || ''),
        row.totalOfferLeads,
        `$${row.offerPayment.toFixed(2)}`,
        `$${row.offerEarnings.toFixed(2)}`
    ]);
    const foot = [
         [{ content: 'TOTALES', colSpan: processed.dayColumns.length + 1, styles: { fontStyle: 'bold', halign: 'right' } },
         { content: processed.totalLeads, styles: { fontStyle: 'bold', halign: 'center' } },
         { content: '', styles: { fontStyle: 'bold', halign: 'center' } },
         { content: `$${processed.totalEarnings.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } }]
    ];

    await exportToPDF({
        head,
        body,
        foot,
        fileName,
        reportTitle,
        companyName: settingsData?.companyName,
        showFooter: true
    });

    setIsExporting(false);
  }


  if (isLoadingPublisher || isUserLoading) {
    return (
        <div className="flex items-center justify-center pt-16">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p className="text-lg">Cargando...</p>
        </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Mi Reporte
        </h1>
        <Button asChild variant="outline">
          <Link href="/publisher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

       <Card>
         <CardHeader>
           <CardTitle>Generar Reporte de Rendimiento</CardTitle>
           <CardDescription>Selecciona un período para consultar tus leads y ganancias.</CardDescription>
         </CardHeader>
         <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="period">Período</Label>
                        <Controller name="period" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar Quincena/Mes" /></SelectTrigger>
                                <SelectContent>{periodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        {errors.period && <p className="text-sm text-destructive">{errors.period.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="month">Mes</Label>
                        <Controller name="month" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                                <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        {errors.month && <p className="text-sm text-destructive">{errors.month.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="year">Año</Label>
                        <Controller name="year" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
                    </div>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Generando...' : 'Generar Reporte'}
                    </Button>
                    <Button type="button" onClick={handleExport} variant="outline" disabled={!reportData || isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar a PDF
                    </Button>
                </div>
            </form>
         </CardContent>
       </Card>

       {isGenerating && (
        <div className="flex items-center justify-center pt-16">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p className="text-lg">Generando tu reporte...</p>
        </div>
       )}

       {reportData && publisherData ? (
           <ReportDisplay reportData={reportData} publisher={publisherData} period={reportData.periodLabel} settings={settingsData} />
       ) : (
           !isGenerating && (
             <Card className="mt-8">
                 <CardContent className="pt-6">
                     <p className="text-muted-foreground text-center">Selecciona un período y haz clic en "Generar Reporte" para ver tus resultados.</p>
                 </CardContent>
             </Card>
           )
       )}

    </div>
  );
}


function ReportDisplay({ reportData, publisher, period, settings }: { reportData: ReportData, publisher: Publisher, period: string, settings: CompanySettings | null | undefined }) {
    const [manualRate, setManualRate] = useState<number>(0);
    
    const processed = processReport(reportData);
    
    const getConversion = () => {
        if (!processed || !publisher) return { amount: processed?.totalEarnings || 0, currency: 'USD' };

        if (publisher.paymentMethod === 'usdt') {
            return { amount: processed.totalEarnings, currency: 'USDT' };
        }
        if (publisher.country === 'VE' && settings?.usdToVesRate) {
            return { amount: processed.totalEarnings * settings.usdToVesRate, currency: 'VES' };
        }
        if (publisher.country === 'CO' && settings?.usdToCopRate) {
            return { amount: processed.totalEarnings * settings.usdToCopRate, currency: 'COP' };
        }
        return { amount: processed.totalEarnings, currency: 'USD' };
    };

    const conversion = getConversion();
    const manualConversion = processed ? processed.totalEarnings * manualRate : 0;

    if (!processed || processed.tableRows.length === 0) return (
         <Card className="mt-8">
            <CardHeader>
                <CardTitle>Sin Actividad</CardTitle>
                <CardDescription>No se han encontrado leads para el período seleccionado: {period}</CardDescription>
            </CardHeader>
        </Card>
    );

    return (
        <Card className="mt-8 border-t pt-4">
            <CardHeader>
                <CardTitle>Hola, {publisher.firstName}</CardTitle>
                <CardDescription>{period}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold min-w-[150px]">Ofertas</TableHead>
                            {processed.dayColumns.map(day => <TableHead key={day} className="text-center">{day}</TableHead>)}
                            <TableHead className="text-center font-bold min-w-[100px] bg-chart-1/20">Total Leads</TableHead>
                            <TableHead className="text-center font-bold min-w-[100px] bg-chart-3/20">Precio (USD)</TableHead>
                            <TableHead className="text-right font-bold min-w-[120px] bg-chart-2/20">Ganancia (USD)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {processed.tableRows.map(row => (
                        <TableRow key={row.offerId}>
                            <TableCell className="font-medium">{row.offerName}</TableCell>
                            {processed.dayColumns.map(day => (
                                <TableCell key={day} className="text-center">
                                    {row.days.get(day) || ''}
                                </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-chart-1/20">{row.totalOfferLeads}</TableCell>
                            <TableCell className="text-center font-medium bg-chart-3/20">${row.offerPayment.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold bg-chart-2/20">${row.offerEarnings.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-primary/90 text-primary-foreground hover:bg-primary/90">
                        <TableCell className="font-bold">TOTALES</TableCell>
                        <TableCell colSpan={processed.dayColumns.length}></TableCell>
                        <TableCell className="text-center font-extrabold text-lg bg-chart-1/20">{processed.totalLeads}</TableCell>
                        <TableCell className="bg-chart-3/20"></TableCell>
                        <TableCell className="text-right font-extrabold text-lg bg-chart-2/20">${processed.totalEarnings.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <div className="p-4 bg-muted rounded-lg flex flex-col justify-center">
                    <span className="text-sm font-semibold text-foreground mb-2">Total Estimado a Cobrar (Tasa oficial)</span>
                    <span className="text-2xl font-extrabold text-primary">
                        {conversion.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {conversion.currency}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">Basado en tu método de pago y la tasa del sistema.</span>
                </div>
                 <div className="space-y-3">
                    <div className='space-y-2'>
                        <Label htmlFor="manualRate">Simular con otra tasa de cambio</Label>
                        <Input 
                            id="manualRate" 
                            type="number"
                            placeholder="Ej: 39.50"
                            value={manualRate || ''}
                            onChange={(e) => setManualRate(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    {manualConversion > 0 && (
                         <div className="p-2 bg-secondary rounded-lg flex items-center justify-between">
                            <span className="text-sm font-bold text-secondary-foreground">Simulación:</span>
                            <span className="text-lg font-bold text-primary">
                                {manualConversion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
