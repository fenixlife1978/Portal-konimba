'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';

// Types
type Publisher = { id: string; firstName: string; lastName: string; email: string; };
type Offer = { id: string; name: string; paymentAmount: number; };
type Lead = { 
  id: string; 
  publisherId: string;
  offerId: string; 
  offerName: string;
  date: string; // YYYY-MM-DD
  quantity: number; 
};

// Schema
const reportFormSchema = z.object({
  publisherId: z.string().nonempty("Debes seleccionar un publisher."),
  month: z.string().nonempty("El mes es requerido."),
  year: z.string().nonempty("El año es requerido."),
});
type ReportFormData = z.infer<typeof reportFormSchema>;

type ReportData = {
  leads: Lead[];
  offersMap: Map<string, Offer>;
  daysInMonth: number;
}

export default function ReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { control, handleSubmit, watch, formState: { errors } } = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
  });

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  // Data fetching for publishers
  const publishersRef = useMemoFirebase(() => firestore ? collection(firestore, 'publishers') : null, [firestore]);
  const { data: publishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);

  const publisherId = watch('publisherId');
  const selectedPublisher = publishers?.find(p => p.id === publisherId);

  const onSubmit = async (data: ReportFormData) => {
    if (!firestore) return;
    setIsGenerating(true);
    setReportData(null);
    
    const { publisherId, month, year } = data;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
      const leadsQuery = query(
        collection(firestore, 'leads'),
        where('publisherId', '==', publisherId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const leadsSnapshot = await getDocs(leadsQuery);
      const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));

      if (leads.length === 0) {
        toast({ title: "Sin resultados", description: "No se encontraron leads para este publisher en el período seleccionado." });
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

      setReportData({ leads, offersMap, daysInMonth });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al generar reporte",
        description: error.message || "No se pudieron obtener los datos.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Date options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];

  const publisherOptions = publishers?.map(p => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} (${p.email})`,
  })) || [];

  const processReport = () => {
    if (!reportData) return null;

    const { leads, offersMap, daysInMonth } = reportData;
    const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const leadsByOffer = new Map<string, { offerName: string, days: Map<number, number> }>();
    leads.forEach(lead => {
        const day = parseInt(lead.date.split('-')[2]);
        if (!leadsByOffer.has(lead.offerId)) {
            leadsByOffer.set(lead.offerId, { offerName: lead.offerName, days: new Map() });
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

    return { dayColumns, tableRows, totalLeads, totalEarnings };
  }

  const processed = processReport();
  const totalInLocalCurrency = processed ? processed.totalEarnings * exchangeRate : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Reportes de Leads</h1>
        <Button asChild variant="outline">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte por Publisher</CardTitle>
          <CardDescription>Selecciona un publisher y un período para ver su rendimiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-3">
                <Label>Publisher</Label>
                <Controller name="publisherId" control={control} render={({ field }) => (
                  <Combobox options={publisherOptions} value={field.value} onChange={field.onChange} placeholder="Busca y selecciona un publisher..." loading={isLoadingPublishers} />
                )} />
                {errors.publisherId && <p className="text-sm text-destructive">{errors.publisherId.message}</p>}
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
            <Button type="submit" disabled={isGenerating}>
              <FileText className="mr-2 h-4 w-4" />
              {isGenerating ? 'Generando...' : 'Generar Reporte'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {processed && selectedPublisher && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Reporte para {selectedPublisher.firstName} {selectedPublisher.lastName}</CardTitle>
                <CardDescription>Período: {months.find(m => m.value === watch('month'))?.label} {watch('year')}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold min-w-[150px]">Ofertas</TableHead>
                            {processed.dayColumns.map(day => <TableHead key={day} className="text-center">{day}</TableHead>)}
                            <TableHead className="text-center font-bold min-w-[100px] bg-secondary">Total Leads</TableHead>
                            <TableHead className="text-center font-bold min-w-[100px] bg-secondary">Precio (USD)</TableHead>
                            <TableHead className="text-right font-bold min-w-[120px] bg-secondary">Ganancia (USD)</TableHead>
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
                            <TableCell className="text-center font-bold bg-secondary">{row.totalOfferLeads}</TableCell>
                            <TableCell className="text-center font-medium bg-secondary">${row.offerPayment.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold bg-secondary">${row.offerEarnings.toFixed(2)}</TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-primary/90 text-primary-foreground hover:bg-primary/90">
                           <TableCell className="font-bold">TOTALES</TableCell>
                           <TableCell colSpan={processed.dayColumns.length}></TableCell>
                           <TableCell className="text-center font-extrabold text-lg">{processed.totalLeads}</TableCell>
                           <TableCell></TableCell>
                           <TableCell className="text-right font-extrabold text-lg">${processed.totalEarnings.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableFooter>
                 </Table>
            </CardContent>
             <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                <div className="space-y-2">
                    <Label htmlFor="exchangeRate">Tasa de Cambio (Opcional)</Label>
                    <Input 
                        id="exchangeRate" 
                        type="number"
                        placeholder="Ej: 390"
                        value={exchangeRate || ''}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                    />
                </div>
                <div className="p-4 bg-muted rounded-lg col-span-2 flex items-center justify-between">
                    <span className="text-lg font-bold text-foreground">TOTAL A COBRAR (BsF)</span>
                    <span className="text-xl font-extrabold text-primary">
                        {totalInLocalCurrency.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
