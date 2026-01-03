'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, Calendar as CalendarIcon, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { exportToPDF } from '@/lib/export-pdf';

// Types
type Publisher = { id: string; subId?: string; firstName: string; lastName: string; email: string; };
type Offer = { id: string; name: string; paymentAmount: number; status: 'active' | 'inactive' };
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
type CompanySettings = {
  companyName?: string;
  companyAddress?: string;
  logoUrl?: string;
  usdToVesRate?: number;
  usdToCopRate?: number;
};


// Schemas
const reportFormSchema = z.object({
  publisherId: z.string().nonempty("Debes seleccionar un publisher."),
  month: z.string().nonempty("El mes es requerido."),
  year: z.string().nonempty("El año es requerido."),
});
type ReportFormData = z.infer<typeof reportFormSchema>;

const generalReportSchema = z.object({
    month: z.string().nonempty("El mes es requerido."),
    year: z.string().nonempty("El año es requerido."),
    period: z.enum(['monthly', 'fortnight-1', 'fortnight-2']).default('monthly'),
});
type GeneralReportFormData = z.infer<typeof generalReportSchema>;

const inactivityReportSchema = z.object({
    period: z.string().nonempty("Debes seleccionar un período."),
});
type InactivityReportFormData = z.infer<typeof inactivityReportSchema>;

type ReportData = {
  leads: Lead[];
  offersMap: Map<string, Offer>;
  daysInPeriod: number[];
  periodLabel: string;
}
type PublisherReportData = {
    publisherInfo: Publisher;
    reportData: ReportData;
}
type GeneralReportResult = {
    publisherReports: PublisherReportData[];
    grandTotalLeads: number;
    grandTotalEarnings: number;
    totalLeadsByOffer: Map<string, { offerName: string, totalLeads: number }>;
}

type InactivePublisher = {
    id: string;
    name: string;
    email: string;
    lastLeadDate: string | null;
};


// Date options for forms
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];
const periodOptionsForSelect = [
    { value: 'monthly', label: 'Mes Completo' },
    { value: 'fortnight-1', label: '1ra Quincena' },
    { value: 'fortnight-2', label: '2da Quincena' },
];


// Main Component
export default function ReportsPage() {
  const firestore = db;
  
  // Data fetching for publishers
  const publishersRef = useMemo(() => firestore ? collection(firestore, 'publishers') : null, [firestore]);
  const { data: publishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);
  
  const offersRef = useMemo(() => firestore ? collection(firestore, 'offers') : null, [firestore]);
  const { data: offers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Reportes de Leads</h1>
        <Button asChild variant="outline">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <Tabs defaultValue="publisher-report">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="publisher-report">Reporte por Publisher</TabsTrigger>
          <TabsTrigger value="general-payment-report">Reporte General de Pagos</TabsTrigger>
          <TabsTrigger value="inactivity-report">Reporte de Inactividad</TabsTrigger>
        </TabsList>
        <TabsContent value="publisher-report">
            <PublisherReport publishers={publishers || []} isLoadingPublishers={isLoadingPublishers} companyName={settingsData?.companyName} />
        </TabsContent>
        <TabsContent value="general-payment-report">
            <GeneralPaymentReport publishers={publishers || []} offers={offers || []} settingsData={settingsData} />
        </TabsContent>
        <TabsContent value="inactivity-report">
            <InactivityReport publishers={publishers || []} companyName={settingsData?.companyName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const processReportData = (reportData: ReportData) => {
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


// #################################################################################
// ## SHARED: Report Display Component
// #################################################################################
function ReportDisplay({ reportData, publisher, period, showExchangeRate = false, tableId }: { reportData: ReportData, publisher: Publisher, period: string, showExchangeRate?: boolean, tableId: string}) {
    const [exchangeRate, setExchangeRate] = useState<number>(0);
    
    const processed = processReportData(reportData);
     if (!processed) return null;

    const totalInLocalCurrency = processed.totalEarnings * exchangeRate;

    return (
        <Card className="mt-8 border-t pt-4" id={tableId}>
            <CardHeader>
                <CardTitle>Reporte para {publisher.firstName} {publisher.lastName} {publisher.subId && `(SUB ID: ${publisher.subId})`}</CardTitle>
                <CardDescription>Período: {period}</CardDescription>
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
           {showExchangeRate && (
             <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                <div className="space-y-2">
                    <Label htmlFor="exchangeRate">Tasa de Cambio (Opcional)</Label>
                    <Input 
                        id="exchangeRate" 
                        type="number"
                        placeholder="Ej: 39.5"
                        value={exchangeRate || ''}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="p-4 bg-muted rounded-lg col-span-2 flex items-center justify-between">
                    <span className="text-lg font-bold text-foreground">TOTAL A COBRAR ({exchangeRate > 0 ? 'Local' : 'USD'})</span>
                    <span className="text-xl font-extrabold text-primary">
                        {totalInLocalCurrency > 0 ? totalInLocalCurrency.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + processed.totalEarnings.toFixed(2)}
                    </span>
                </div>
            </CardContent>
           )}
        </Card>
    );
}


// #################################################################################
// ## TAB 1: Reporte por Publisher
// #################################################################################

function PublisherReport({ publishers, isLoadingPublishers, companyName }: { publishers: Publisher[], isLoadingPublishers: boolean, companyName?: string }) {
    const firestore = db;
    const { toast } = useToast();
    const { control, handleSubmit, watch, formState: { errors } } = useForm<ReportFormData>({
        resolver: zodResolver(reportFormSchema),
    });

    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const publisherId = watch('publisherId');
    const selectedPublisher = publishers?.find(p => p.id === publisherId);

    const publisherOptions = useMemo(() => publishers?.map(p => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName} (${p.subId ? `SUB ID: ${p.subId} - ` : ''}${p.email})`,
    })) || [], [publishers]);

    const handleExport = async () => {
        if (!reportData || !selectedPublisher) return;
        setIsExporting(true);
        const reportTitle = `Reporte de Publisher - ${selectedPublisher.firstName} ${selectedPublisher.lastName} ${selectedPublisher.subId ? `(SUB ID: ${selectedPublisher.subId})` : ''}`;
        const fileName = `Reporte_Publisher_${selectedPublisher.lastName}_${reportData.periodLabel.replace(' ','_')}.pdf`;
        
        const processed = processReportData(reportData);
        if (!processed) {
            setIsExporting(false);
            return;
        }

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

        await exportToPDF({ head, body, foot, fileName, reportTitle, companyName, showFooter: true });
        setIsExporting(false);
    };

    const onSubmit = async (data: ReportFormData) => {
        if (!firestore || !selectedPublisher) return;
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
                where('date', '<=', endDate),
                orderBy('date', 'asc')
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
            const monthLabel = months.find(m => m.value === watch('month'))?.label || '';
            const periodLabel = `${monthLabel} ${watch('year')}`;
            setReportData({ leads, offersMap, daysInPeriod: Array.from({ length: daysInMonth }, (_, i) => i + 1), periodLabel });

        } catch (error: any) {
            console.error("Report Generation Error:", error);
            const firebaseUrl = error.message.match(/https:\/\/console.firebase.google.com\/project\/[^/]+\/database\/firestore\/indexes\?create_composite=.*/);
            toast({
                variant: "destructive",
                title: "Error al generar reporte",
                description: firebaseUrl 
                ? "Se necesita un índice de Firestore. Revisa la consola del navegador para crearlo."
                : error.message || "No se pudieron obtener los datos.",
            });
             if (firebaseUrl) {
                console.error(`Firestore Index Required. Please create it by visiting this URL: ${firebaseUrl[0]}`);
            }
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
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
                <div className="flex gap-2">
                    <Button type="submit" disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Generando...' : 'Generar Reporte'}
                    </Button>
                     <Button type="button" variant="outline" onClick={handleExport} disabled={!reportData || isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar a PDF
                    </Button>
                </div>
            </form>
            </CardContent>

             {reportData && selectedPublisher && (
                <ReportDisplay tableId="publisher-report-table-container" reportData={reportData} publisher={selectedPublisher} period={reportData.periodLabel} showExchangeRate={true} />
            )}
        </Card>
    );
}

function SelectionModal<T extends string>({ open, onOpenChange, title, options, value, onValueChange, fieldName }: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    title: string,
    options: { value: T, label: string }[],
    value: T,
    onValueChange: (value: T) => void,
    fieldName: string
}) {
    const [selectedValue, setSelectedValue] = useState(value);

    useEffect(() => {
        setSelectedValue(value);
    }, [value, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <RadioGroup value={selectedValue} onValueChange={(val: T) => setSelectedValue(val)}>
                        {options.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                                <RadioGroupItem value={option.value} id={`${fieldName}-${option.value}`} />
                                <Label htmlFor={`${fieldName}-${option.value}`}>{option.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={() => { onValueChange(selectedValue); onOpenChange(false); }}>Seleccionar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// #################################################################################
// ## TAB 2: Reporte General de Pagos
// #################################################################################
type Period = "monthly" | "fortnight-1" | "fortnight-2";
const periodOptions: { value: Period; label: string }[] = [
  { value: "monthly", label: "Mes Completo" },
  { value: "fortnight-1", label: "1ra Quincena" },
  { value: "fortnight-2", label: "2da Quincena" },
];

function GeneralPaymentReport({ publishers, offers, settingsData }: { publishers: Publisher[], offers: Offer[], settingsData?: CompanySettings | null }) {
    const firestore = db;
    const { toast } = useToast();
    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<GeneralReportFormData>({
        resolver: zodResolver(generalReportSchema),
        defaultValues: {
            period: 'monthly',
            month: String(new Date().getMonth() + 1),
            year: String(new Date().getFullYear()),
        }
    });

    const [periodModalOpen, setPeriodModalOpen] = useState(false);
    const [monthModalOpen, setMonthModalOpen] = useState(false);
    const [yearModalOpen, setYearModalOpen] = useState(false);

    const [reportData, setReportData] = useState<GeneralReportResult | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const watchedPeriod = watch('period');
    const watchedMonth = watch('month');
    const watchedYear = watch('year');
    
    const handleExport = async () => {
        if (!reportData) return;
        setIsExporting(true);
    
        const periodLabel = reportData.publisherReports[0]?.reportData.periodLabel || "General";
        const reportTitle = `Reporte General de Pagos: ${periodLabel}`;
        const fileName = `Reporte_General_Pagos_${periodLabel.replace(/ /g, '_')}.pdf`;
    
        let allTables: any = [];
    
        reportData.publisherReports.forEach((pubReport) => {
            const processed = processReportData(pubReport.reportData);
            if (!processed) return;
    
            const head = [["Oferta", ...processed.dayColumns.map(String), "Total Leads", "Precio (USD)", "Ganancia (USD)"]];
            const body = processed.tableRows.map(row => [
                row.offerName,
                ...processed.dayColumns.map(day => row.days.get(day) || ''),
                row.totalOfferLeads,
                `$${row.offerPayment.toFixed(2)}`,
                `$${row.offerEarnings.toFixed(2)}`
            ]);
            const foot = [
                 [{ content: 'Subtotales', colSpan: processed.dayColumns.length + 1, styles: { fontStyle: 'bold', halign: 'right' } },
                 { content: processed.totalLeads, styles: { fontStyle: 'bold', halign: 'center' } },
                 '',
                 { content: `$${processed.totalEarnings.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } }]
            ];
    
            const subHeader = `${pubReport.publisherInfo.firstName} ${pubReport.publisherInfo.lastName} ${pubReport.publisherInfo.subId ? `(SUB ID: ${pubReport.publisherInfo.subId})` : ''}`;

            allTables.push({
                subHeader: subHeader,
                head,
                body,
                foot,
            });
        });
    
        await exportToPDF({
            tables: allTables,
            reportTitle,
            fileName,
            companyName: settingsData?.companyName,
            showFooter: true,
        });
    
        setIsExporting(false);
    };

    const onSubmit = async (data: GeneralReportFormData) => {
        if (!firestore) return;
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
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );
            const leadsSnapshot = await getDocs(leadsQuery);
            const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));

            if (leads.length === 0) {
                toast({ title: "Sin resultados", description: "No se encontraron leads en el período seleccionado." });
                setIsGenerating(false);
                return;
            }

            const offerIds = [...new Set(leads.map(lead => lead.offerId))];
            const offersMap = new Map<string, Offer>();
            if (offerIds.length > 0) {
                const offersQuery = query(collection(firestore, 'offers'), where('__name__', 'in', offerIds));
                const offersSnapshot = await getDocs(offersQuery);
                offersSnapshot.docs.forEach(doc => offersMap.set(doc.id, { id: doc.id, ...doc.data() } as Offer));
            }
            
            const leadsByPublisher = new Map<string, Lead[]>();
            leads.forEach(lead => {
                if (!leadsByPublisher.has(lead.publisherId)) {
                    leadsByPublisher.set(lead.publisherId, []);
                }
                leadsByPublisher.get(lead.publisherId)!.push(lead);
            });

            let grandTotalEarnings = 0;
            let grandTotalLeads = 0;
            const totalLeadsByOffer = new Map<string, { offerName: string, totalLeads: number }>();
            
            const publisherReports: PublisherReportData[] = [];
            for (const [pubId, pubLeads] of leadsByPublisher.entries()) {
                const publisherInfo = publishers.find(p => p.id === pubId);
                if (publisherInfo) {
                     pubLeads.forEach(lead => {
                        const offerName = lead.offerName || 'Desconocida';
                        const current = totalLeadsByOffer.get(lead.offerId) || { offerName: offerName, totalLeads: 0 };
                        current.totalLeads += lead.quantity;
                        totalLeadsByOffer.set(lead.offerId, current);

                        grandTotalLeads += lead.quantity;
                        const offer = offersMap.get(lead.offerId);
                        grandTotalEarnings += (offer?.paymentAmount || 0) * lead.quantity;
                    });
                    
                    publisherReports.push({
                        publisherInfo: publisherInfo,
                        reportData: {
                            leads: pubLeads,
                            offersMap: offersMap,
                            daysInPeriod: daysInPeriodArray,
                            periodLabel: periodLabel
                        }
                    });
                }
            }
            
            publisherReports.sort((a,b) => a.publisherInfo.firstName.localeCompare(b.publisherInfo.firstName));

            setReportData({ publisherReports, grandTotalLeads, grandTotalEarnings, totalLeadsByOffer });

        } catch (error: any) {
            console.error("General Report Error:", error);
            const firebaseUrl = error.message.match(/https:\/\/console.firebase.google.com\/project\/[^/]+\/database\/firestore\/indexes\?create_composite=.*/);
            toast({ 
                variant: "destructive", 
                title: "Error al generar reporte", 
                description: firebaseUrl ? "Se necesita un índice de Firestore para esta consulta. Revisa la consola para obtener el enlace de creación." : error.message 
            });
            if (firebaseUrl) {
                console.error(`Firestore Index Required. Please create it by visiting this URL: ${firebaseUrl[0]}`);
            }
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Reporte General de Pagos</CardTitle>
                <CardDescription>Ver todos los publishers que generaron ganancias en un período específico.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="space-y-2">
                            <Label>Período</Label>
                             <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setPeriodModalOpen(true)}>
                                 <CalendarIcon className="mr-2 h-4 w-4" />
                                 {periodOptions.find(p => p.value === watchedPeriod)?.label || 'Seleccionar Período'}
                             </Button>
                             {errors.period && <p className="text-sm text-destructive">{errors.period.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Mes</Label>
                             <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setMonthModalOpen(true)}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {months.find(m => m.value === watchedMonth)?.label || 'Seleccionar Mes'}
                             </Button>
                            {errors.month && <p className="text-sm text-destructive">{errors.month.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Año</Label>
                             <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setYearModalOpen(true)}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {watchedYear || 'Seleccionar Año'}
                             </Button>
                            {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
                        </div>
                    </div>
                     <div className="flex gap-2">
                        <Button type="submit" disabled={isGenerating}>
                             {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Generando...' : 'Generar Reporte'}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleExport} disabled={!reportData || isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Exportar a PDF
                        </Button>
                    </div>
                </form>

                <SelectionModal
                  open={periodModalOpen}
                  onOpenChange={setPeriodModalOpen}
                  title="Seleccionar Período"
                  options={periodOptions}
                  value={watchedPeriod as Period}
                  onValueChange={(value) => setValue("period", value as Period)}
                  fieldName="period"
                />
                
                <SelectionModal
                    open={monthModalOpen}
                    onOpenChange={setMonthModalOpen}
                    title="Seleccionar Mes"
                    options={months}
                    value={watchedMonth}
                    onValueChange={(value) => setValue('month', value)}
                    fieldName="month"
                />
                
                <SelectionModal
                    open={yearModalOpen}
                    onOpenChange={setYearModalOpen}
                    title="Seleccionar Año"
                    options={years.map(y => ({ value: String(y), label: String(y) }))}
                    value={watchedYear}
                    onValueChange={(value) => setValue('year', value)}
                    fieldName="year"
                />
            </CardContent>

            {reportData && (
                <div id="general-payment-report-container">
                    <CardContent className="mt-6 space-y-8">
                        {reportData.publisherReports.length === 0 ? (
                            <p className="text-center text-muted-foreground">No hay datos para este período.</p>
                        ) : (
                            <>
                            {reportData.publisherReports.map(({ publisherInfo, reportData }, index) => (
                            <ReportDisplay key={publisherInfo.id} tableId={`general-report-sub-table-${index}`} publisher={publisherInfo} reportData={reportData} period={reportData.periodLabel} />
                            ))}
                            
                            <Separator className="my-8" />
                            
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle>Resumen General de la Nómina</CardTitle>
                                    <CardDescription>Totales para el período seleccionado: {reportData.publisherReports[0].reportData.periodLabel}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Oferta</TableHead>
                                                <TableHead className="text-right">Total Leads Generados</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Array.from(reportData.totalLeadsByOffer.entries()).map(([offerId, data]) => (
                                                <TableRow key={offerId}>
                                                    <TableCell className="font-medium">{data.offerName}</TableCell>
                                                    <TableCell className="text-right">{data.totalLeads}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                        <TableFooter>
                                            <TableRow className="bg-primary/90 text-primary-foreground hover:bg-primary/90">
                                                <TableCell className="font-bold">TOTALES</TableCell>
                                                <TableCell className="text-right font-extrabold text-lg">{reportData.grandTotalLeads}</TableCell>
                                            </TableRow>
                                        </TableFooter>
                                    </Table>

                                    <div className="mt-6 p-4 bg-primary/90 text-primary-foreground rounded-lg flex items-center justify-between">
                                        <span className="text-lg font-bold">TOTAL NÓMINA (USD)</span>
                                        <span className="text-2xl font-extrabold">${reportData.grandTotalEarnings.toFixed(2)}</span>
                                    </div>
                                    {settingsData && (
                                    <Card className="mt-4">
                                        <CardHeader><CardTitle>Nómina en Moneda Local</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {settingsData.usdToVesRate && (
                                                <div className="flex justify-between items-center p-2 bg-background rounded">
                                                    <span className="font-bold">Total en Bolívares (VES)</span>
                                                    <span className="font-mono text-primary">{(reportData.grandTotalEarnings * settingsData.usdToVesRate).toLocaleString('es-VE', { style: 'currency', currency: 'VES' })}</span>
                                                </div>
                                            )}
                                            {settingsData.usdToCopRate && (
                                                <div className="flex justify-between items-center p-2 bg-background rounded">
                                                    <span className="font-bold">Total en Pesos (COP)</span>
                                                    <span className="font-mono text-primary">{(reportData.grandTotalEarnings * settingsData.usdToCopRate).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                    )}
                                </CardContent>
                            </Card>
                            </>
                        )}
                    </CardContent>
                </div>
            )}
        </Card>
    );
}


// #################################################################################
// ## TAB 3: Reporte de Inactividad
// #################################################################################

function InactivityReport({ publishers, companyName }: { publishers: Publisher[], companyName?: string }) {
    const firestore = db;
    const { toast } = useToast();
    const { control, handleSubmit, formState: { errors }, watch } = useForm<InactivityReportFormData>({
        resolver: zodResolver(inactivityReportSchema),
    });
    const [reportData, setReportData] = useState<InactivePublisher[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const periodOptions = [
        { value: '1', label: '1 Mes' },
        { value: '2', label: '2 Meses' },
        { value: '3-6', label: '3 a 6 Meses' },
        { value: '6+', label: 'Más de 6 Meses' },
    ];
    
    const watchedPeriod = watch('period');
    
    const handleExport = async () => {
        if (!reportData) return;
        setIsExporting(true);
        const periodLabel = periodOptions.find(p => p.value === watchedPeriod)?.label || "Inactividad";
        const reportTitle = `Reporte de Inactividad de Publishers (${periodLabel})`;
        const fileName = `Reporte_Inactividad_${periodLabel.replace(' ','_')}.pdf`;

        const head = [['Publisher', 'Email', 'Último Lead Registrado']];
        const body = reportData.map(p => [p.name, p.email, p.lastLeadDate || 'Nunca']);

        await exportToPDF({ head, body, fileName, reportTitle, companyName });
        setIsExporting(false);
    };

    const onSubmit = async (data: InactivityReportFormData) => {
        if (!firestore || publishers.length === 0) return;
        setIsGenerating(true);
        setReportData(null);

        const { period } = data;
        const now = new Date();
        let startDate: Date;

        if (period === '1') startDate = new Date(new Date().setMonth(now.getMonth() - 1));
        else if (period === '2') startDate = new Date(new Date().setMonth(now.getMonth() - 2));
        else if (period === '3-6') startDate = new Date(new Date().setMonth(now.getMonth() - 6));
        else startDate = new Date(new Date().setMonth(now.getMonth() - 12)); // A proxy for > 6 months

        try {
            const leadsQuery = query(
                collection(firestore, 'leads'),
                orderBy('createdAt', 'desc')
            );
            const leadsSnapshot = await getDocs(leadsQuery);
            const leads = leadsSnapshot.docs.map(doc => doc.data() as Lead);

            const lastLeadDateByPublisher = new Map<string, Date>();
            leads.forEach(lead => {
                if (!lastLeadDateByPublisher.has(lead.publisherId)) {
                    lastLeadDateByPublisher.set(lead.publisherId, lead.createdAt.toDate());
                }
            });
            
            let inactivePublishers: InactivePublisher[] = [];

            if (period === '3-6') {
                const threeMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 3));
                inactivePublishers = publishers
                    .filter(p => {
                        const lastLeadDate = lastLeadDateByPublisher.get(p.id);
                        return !lastLeadDate || (lastLeadDate < threeMonthsAgo && lastLeadDate >= startDate);
                    })
                    .map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, lastLeadDate: lastLeadDateByPublisher.get(p.id)?.toLocaleDateString() || 'Nunca' }));
            } else {
                 const endDate = period === '6+' ? new Date(new Date().setMonth(new Date().getMonth() - 6)) : startDate;
                 inactivePublishers = publishers
                    .filter(p => {
                        const lastLeadDate = lastLeadDateByPublisher.get(p.id);
                        return !lastLeadDate || lastLeadDate < endDate;
                    })
                    .map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, lastLeadDate: lastLeadDateByPublisher.get(p.id)?.toLocaleDateString() || 'Nunca' }));
            }
             
            setReportData(inactivePublishers);
            if (inactivePublishers.length === 0) {
                 toast({ title: "Sin resultados", description: "Todos los publishers están activos para este período." });
            }

        } catch (error: any) {
            console.error("Inactivity Report Error:", error);
            toast({ variant: "destructive", title: "Error al generar reporte", description: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Reporte de Inactividad de Publishers</CardTitle>
                <CardDescription>Encuentra publishers que no han generado leads en un período determinado.</CardDescription>
            </CardHeader>
            <CardContent>
                 <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="period">Período de Inactividad</Label>
                            <Controller name="period" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona un período" /></SelectTrigger>
                                    <SelectContent>
                                        {periodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                            {errors.period && <p className="text-sm text-destructive">{errors.period.message}</p>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Generando...' : 'Generar Reporte'}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleExport} disabled={!reportData || isExporting}>
                           {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                           Exportar a PDF
                        </Button>
                    </div>
                </form>
            </CardContent>

             {reportData && (
                <CardContent className="mt-6" id="inactivity-report-container">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Publisher</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="text-right">Último Lead Registrado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No hay publishers inactivos para este período.</TableCell></TableRow>}
                            {reportData.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.email}</TableCell>
                                    <TableCell className="text-right">{item.lastLeadDate}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            )}
        </Card>
    );
}
