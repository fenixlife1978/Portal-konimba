'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc, useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, Timestamp, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Calculator, Check, Download, FileText, Trash2, FolderDown, MoreHorizontal, Undo } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { exportToPDF } from '@/lib/export-pdf';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


// Types
type Publisher = { id: string; firstName: string; lastName: string; paymentMethod?: 'pagoMovil' | 'transferencia' | 'usdt'; country?: 'VE' | 'CO'; };
type Offer = { id: string; name: string; paymentAmount: number };
type Lead = { publisherId: string; offerId: string; quantity: number; date: string; publisherName: string; };
type CompanySettings = { usdToVesRate?: number; usdToCopRate?: number; companyName?: string };
type Payment = {
  id: string;
  publisherId: string;
  publisherName: string;
  paymentPeriod: string;
  amountUSD: number;
  amountVES: number;
  amountCOP: number;
  status: 'pending' | 'paid';
  createdAt: Timestamp;
  paidAt?: Timestamp;
};

type PaymentTotals = {
    totalUSD: number;
    totalVES: number;
    totalCOP: number;
    hasVES: boolean;
    hasCOP: boolean;
};

// Schema
const paymentFormSchema = z.object({
  month: z.string().nonempty("El mes es requerido."),
  year: z.string().nonempty("El año es requerido."),
  period: z.enum(['fortnight-1', 'fortnight-2']),
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

// Date options for forms
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];

// Helper Function
const formatPaymentPeriod = (period: string | null) => {
  if (!period) return '';
  const parts = period.split('-');
  const year = parts[0];
  const month = months.find(m => m.value === parts[1])?.label;
  const fortnight = period.endsWith('fortnight-1') ? '1ra Quincena' : '2da Quincena';
  return `${year}-${month} - ${fortnight}`;
};

export default function PaymentsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('pending');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for pending payments
  const [pendingPaymentPeriod, setPendingPaymentPeriod] = useState<string | null>(null);
  
  // State for history payments
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()));
  const [historyMonth, setHistoryMonth] = useState(String(new Date().getMonth() + 1));
  const [isExportingHistory, setIsExportingHistory] = useState(false);


  // Data fetching
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);
  
  const publishersRef = useMemo(() => (firestore && user) ? collection(firestore, 'publishers') : null, [firestore, user]);
  const { data: publishersData } = useCollection<Publisher>(publishersRef);

  // Queries for payments
  const pendingPaymentsQuery = useMemo(() => {
    if (!firestore || !pendingPaymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", pendingPaymentPeriod), where("status", "==", "pending"));
  }, [firestore, pendingPaymentPeriod]);
  
  const { data: pendingPayments, isLoading: isLoadingPending, error: pendingError } = useCollection<Payment>(pendingPaymentsQuery);

  const historyPaymentsQuery = useMemo(() => {
      if (!firestore) return null;
      const historyPeriodPrefix = `${historyYear}-${historyMonth}`;
      return query(
          collection(firestore, "payments"), 
          where("status", "==", "paid"),
          where("paymentPeriod", ">=", historyPeriodPrefix),
          where("paymentPeriod", "<", `${historyPeriodPrefix}~`),
          orderBy("paymentPeriod", "desc"),
          orderBy("paidAt", "desc")
      );
  }, [firestore, historyYear, historyMonth]);

  const { data: paidPayments, isLoading: isLoadingHistory, error: historyError } = useCollection<Payment>(historyPaymentsQuery);


  const { control, handleSubmit } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      period: 'fortnight-1',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    },
  });

  const getPeriodData = (data: PaymentFormData) => {
    const { month, year, period } = data;
    const currentPaymentPeriod = `${year}-${month}-${period}`;
    let startDay = 1, endDay = 15;
    if (period === 'fortnight-2') {
        startDay = 16;
        endDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    }
    const startDate = `${year}-${month.padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${year}-${month.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    return { currentPaymentPeriod, startDate, endDate };
  }
  
  const handleCalculateAndSave = async (data: PaymentFormData) => {
     if (!firestore || !publishersData) return;
    setIsCalculating(true);
    setPendingPaymentPeriod(null);

    const { currentPaymentPeriod, startDate, endDate } = getPeriodData(data);
    
    try {
        const existingPaymentsQuery = query(collection(firestore, "payments"), where("paymentPeriod", "==", currentPaymentPeriod));
        const existingPaymentsSnapshot = await getDocs(existingPaymentsQuery);
        if (!existingPaymentsSnapshot.empty) {
            toast({ title: "Cálculo Omitido", description: "Ya existe una nómina (pagada o pendiente) para este período. Puede eliminar la nómina pendiente si desea recalcular." });
            setIsCalculating(false);
            return;
        }

        const leadsQuery = query(collection(firestore, 'leads'), where('date', '>=', startDate), where('date', '<=', endDate));
        const leadsSnapshot = await getDocs(leadsQuery);
        const leads = leadsSnapshot.docs.map(doc => doc.data() as Lead);

        if (leads.length === 0) {
            toast({ title: "Sin Resultados", description: "No se encontraron leads para el período seleccionado." });
            setIsCalculating(false);
            return;
        }

        const offersQuery = query(collection(firestore, 'offers'));
        const offersSnapshot = await getDocs(offersQuery);
        const offersMap = new Map(offersSnapshot.docs.map(doc => [doc.id, doc.data() as Offer]));
        const publishersMap = new Map(publishersData.map(p => [p.id, p]));

        const earningsByPublisher = new Map<string, { total: number, name: string }>();

        leads.forEach(lead => {
            const offer = offersMap.get(lead.offerId);
            if (offer) {
                const earning = lead.quantity * offer.paymentAmount;
                const currentEarning = earningsByPublisher.get(lead.publisherId) || { total: 0, name: lead.publisherName };
                earningsByPublisher.set(lead.publisherId, {
                    total: currentEarning.total + earning,
                    name: currentEarning.name,
                });
            }
        });
        
        if (earningsByPublisher.size === 0) {
            toast({ title: "Cálculo completado", description: "No se generaron pagos. Puede que las ofertas asociadas no tengan monto de pago." });
            setIsCalculating(false);
            return;
        }

        const usdToVes = settingsData?.usdToVesRate || 0;
        const usdToCop = settingsData?.usdToCopRate || 0;
        const batch = writeBatch(firestore);

        for (const [publisherId, earnings] of earningsByPublisher.entries()) {
            const paymentRef = doc(collection(firestore, 'payments'));
            const publisherInfo = publishersMap.get(publisherId);
            
            let amountVES = 0;
            let amountCOP = 0;

            if (publisherInfo?.paymentMethod === 'usdt') {
                // Keep as USD
            } else if (publisherInfo?.country === 'VE' && (publisherInfo.paymentMethod === 'pagoMovil' || publisherInfo.paymentMethod === 'transferencia')) {
                amountVES = earnings.total * usdToVes;
            } else if (publisherInfo?.country === 'CO' && publisherInfo.paymentMethod === 'transferencia') {
                amountCOP = earnings.total * usdToCop;
            }

            const paymentData = {
                publisherId,
                publisherName: earnings.name,
                paymentPeriod: currentPaymentPeriod,
                amountUSD: earnings.total, // Store original USD amount for records
                amountVES: amountVES,
                amountCOP: amountCOP,
                status: 'pending',
                createdAt: serverTimestamp(),
            };
            batch.set(paymentRef, paymentData);
        }

        await batch.commit();
        toast({ title: "Nómina Calculada y Guardada", description: `Se han generado ${earningsByPublisher.size} pagos pendientes. Ahora puede cargarlos para procesar.` });

    } catch (error: any) {
        console.error("Payment calculation error", error);
        toast({ variant: "destructive", title: "Error al Calcular", description: error.message });
    } finally {
        setIsCalculating(false);
    }
  };

  const handleLoadPeriod = (data: PaymentFormData) => {
    const { currentPaymentPeriod } = getPeriodData(data);
    setPendingPaymentPeriod(currentPaymentPeriod);
    toast({
        title: "Cargando Nómina",
        description: `Buscando pagos pendientes para el período ${formatPaymentPeriod(currentPaymentPeriod)}.`
    })
  };
  
  const handleDeletePeriod = async () => {
    if (!firestore || !pendingPaymentPeriod) {
        toast({ variant: "destructive", title: "Error", description: "No hay un período seleccionado para eliminar." });
        return;
    }
    setIsDeleting(true);

    try {
        const paymentsToDeleteQuery = query(collection(firestore, "payments"), where("paymentPeriod", "==", pendingPaymentPeriod), where("status", "==", "pending"));
        const snapshot = await getDocs(paymentsToDeleteQuery);

        if(snapshot.empty) {
            toast({ title: "Sin Cambios", description: "No se encontraron pagos pendientes para eliminar en este período." });
            setIsDeleting(false);
            return;
        }

        const batch = writeBatch(firestore);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        toast({ title: "Nómina Eliminada", description: `Se eliminaron ${snapshot.size} pagos pendientes.` });
        setPendingPaymentPeriod(null); // Clear the view

    } catch (error: any) {
        console.error("Delete error", error);
        toast({ variant: "destructive", title: "Error al Eliminar", description: error.message });
    } finally {
        setIsDeleting(false);
    }
  }

  
  const handleMarkAsPaid = (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    updateDocumentNonBlocking(paymentRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
    });
    toast({ title: "Pago Confirmado", description: "El pago se ha movido al historial." });
  };
  
  const handleMarkAsUnpaid = async (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    // Using async/await here for immediate feedback, though non-blocking could also be used
    try {
        await updateDoc(paymentRef, {
            status: 'pending',
            paidAt: null, // Remove paidAt timestamp
        });
        toast({ title: "Pago Revertido", description: "El pago ha sido marcado como pendiente." });
    } catch(error: any) {
        toast({ variant: "destructive", title: "Error al revertir", description: error.message });
    }
  };

  const handlePermanentlyDelete = async (paymentId: string) => {
      if(!firestore) return;
      const paymentRef = doc(firestore, 'payments', paymentId);
      try {
        await deleteDoc(paymentRef);
        toast({ title: "Registro Eliminado", description: "El registro de pago ha sido eliminado permanentemente." });
      } catch (error: any) {
         toast({ variant: "destructive", title: "Error al eliminar", description: error.message });
      }
  }

  const handleExportHistory = async () => {
      if (!paidPayments || paidPayments.length === 0) return;
      setIsExportingHistory(true);

      const periodLabel = `${months.find(m => m.value === historyMonth)?.label} ${historyYear}`;
      const reportTitle = `Historial de Pagos - ${periodLabel}`;
      const fileName = `Historial_Pagos_${historyYear}_${historyMonth}.pdf`;
      
      const columns = ['Período de Pago', 'Publisher', 'Monto (USD)', 'Fecha de Pago'];
      const data = paidPayments.map(p => [
          formatPaymentPeriod(p.paymentPeriod),
          p.publisherName,
          `$${p.amountUSD.toFixed(2)}`,
          p.paidAt ? p.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'
      ]);

      await exportToPDF({
          head: [columns],
          body: data, 
          fileName, 
          reportTitle, 
          companyName: settingsData?.companyName
      });
      setIsExportingHistory(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Pagos</h1>
        <Button asChild variant="outline">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">Nómina Pendiente</TabsTrigger>
                <TabsTrigger value="history">Historial de Pagos</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
                <Card>
                    <CardHeader>
                    <CardTitle>Nómina de Pagos de Quincena</CardTitle>
                    <CardDescription>
                        Calcula, carga o elimina una nómina de pagos para un período específico.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                        <Label htmlFor="year">Año</Label>
                        <Controller name="year" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="month">Mes</Label>
                        <Controller name="month" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="period">Quincena</Label>
                        <Controller name="period" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Quincena" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fortnight-1">1ra Quincena</SelectItem>
                                <SelectItem value="fortnight-2">2da Quincena</SelectItem>
                            </SelectContent>
                            </Select>
                        )} />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                        <Button onClick={handleSubmit(handleCalculateAndSave)} disabled={isCalculating}>
                            {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            {isCalculating ? 'Calculando...' : 'Calcular y Guardar Nómina'}
                        </Button>
                        <Button onClick={handleSubmit(handleLoadPeriod)} variant="secondary">
                            <FolderDown className="mr-2 h-4 w-4" />
                            Cargar Nómina Pendiente
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={!pendingPaymentPeriod || (pendingPayments && pendingPayments.length === 0)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar Nómina Pendiente
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro de que deseas eliminar esta nómina?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción eliminará todos los pagos pendientes para el período <span className="font-bold">{formatPaymentPeriod(pendingPaymentPeriod)}</span>. Esta operación no se puede deshacer.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeletePeriod} disabled={isDeleting}>
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Sí, eliminar nómina
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    </CardContent>
                </Card>
                
                {pendingError && (
                    <Alert variant="destructive" className="mt-4">
                    <AlertTitle>Error de Firestore</AlertTitle>
                    <AlertDescription>No se pudieron cargar los pagos. Es posible que necesites crear un índice compuesto en Firestore. Revisa la consola para más detalles.</AlertDescription>
                    </Alert>
                )}

                {pendingPaymentPeriod && (
                    <PendingPaymentsTable 
                        payments={pendingPayments}
                        isLoading={isLoadingPending}
                        period={pendingPaymentPeriod}
                        settingsData={settingsData}
                        onMarkAsPaid={handleMarkAsPaid}
                    />
                )}
            </TabsContent>
            <TabsContent value="history">
                 <Card>
                    <CardHeader>
                        <CardTitle>Historial de Pagos Realizados</CardTitle>
                        <CardDescription>Consulta los pagos que ya han sido procesados y exporta reportes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4 items-end mb-4">
                            <div className="space-y-2">
                                <Label htmlFor="history-year">Año</Label>
                                <Select onValueChange={setHistoryYear} value={historyYear}>
                                    <SelectTrigger id="history-year"><SelectValue placeholder="Año" /></SelectTrigger>
                                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="history-month">Mes</Label>
                                <Select onValueChange={setHistoryMonth} value={historyMonth}>
                                    <SelectTrigger id="history-month"><SelectValue placeholder="Mes" /></SelectTrigger>
                                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleExportHistory} variant="outline" disabled={isExportingHistory || !paidPayments || paidPayments.length === 0}>
                                {isExportingHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Exportar Historial
                            </Button>
                        </div>

                         {historyError && (
                            <Alert variant="destructive" className="mt-4">
                            <AlertTitle>Error de Firestore</AlertTitle>
                            <AlertDescription>No se pudo cargar el historial. Es posible que necesites crear un índice compuesto en Firestore. Revisa la consola para más detalles.</AlertDescription>
                            </Alert>
                        )}
                        
                        <PaymentHistoryTable
                            payments={paidPayments}
                            isLoading={isLoadingHistory}
                            onMarkAsUnpaid={handleMarkAsUnpaid}
                            onDelete={handlePermanentlyDelete}
                        />
                    </CardContent>
                 </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

// Sub-component for Pending Payments Table
function PendingPaymentsTable({ payments, isLoading, period, settingsData, onMarkAsPaid }: { payments: Payment[] | null, isLoading: boolean, period: string, settingsData: CompanySettings | null, onMarkAsPaid: (id: string) => void }) {
    const [isExporting, setIsExporting] = useState(false);

    const memoizedPaymentTotals = useMemo((): PaymentTotals | null => {
        if (!payments) return null;

        return payments.reduce((totals, payment) => {
            if (payment.amountVES > 0) {
                totals.totalVES += payment.amountVES;
                totals.hasVES = true;
            } else if (payment.amountCOP > 0) {
                totals.totalCOP += payment.amountCOP;
                totals.hasCOP = true;
            } else {
                totals.totalUSD += payment.amountUSD;
            }
            return totals;
        }, { totalUSD: 0, totalVES: 0, totalCOP: 0, hasVES: false, hasCOP: false });
    }, [payments]);

    const handleExport = async () => {
        if (!payments || payments.length === 0 || !period) return;
        setIsExporting(true);

        const formattedPeriod = formatPaymentPeriod(period);
        const reportTitle = `Nómina de Pagos Pendientes - ${formattedPeriod}`;
        const fileName = `Nomina_Pagos_${period}.pdf`;

        const columns = ['Publisher', 'Monto (USD)', 'Monto (COP)', 'Monto (VES)'];
        const data = payments.map(p => [
            p.publisherName,
            `$${p.amountUSD.toFixed(2)}`,
            p.amountCOP > 0 ? p.amountCOP.toLocaleString('es-CO', {style: 'currency', currency: 'COP'}) : '-',
            p.amountVES > 0 ? p.amountVES.toLocaleString('es-VE', {style: 'currency', currency: 'VES'}) : '-',
        ]);

        await exportToPDF({
            head: [columns],
            body: data, 
            fileName, 
            reportTitle, 
            companyName: settingsData?.companyName
        });
        setIsExporting(false);
    };

    return (
        <Card className="mt-8" id="payments-table-container">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Pagos Pendientes para el Período: {formatPaymentPeriod(period)}</CardTitle>
                    <CardDescription>Lista de publishers con pagos por procesar para el período seleccionado.</CardDescription>
                </div>
                 <Button onClick={handleExport} variant="outline" disabled={isExporting || !payments || payments.length === 0}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar a PDF
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead className="text-right">Monto (USD)</TableHead>
                  <TableHead className="text-right">Monto (COP)</TableHead>
                  <TableHead className="text-right">Monto (VES)</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando pagos pendientes...</TableCell></TableRow>}
                {!isLoading && payments?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay pagos pendientes para este período.</TableCell></TableRow>}
                {payments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.publisherName}</TableCell>
                    <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{payment.amountCOP > 0 ? payment.amountCOP.toLocaleString('es-CO', {style: 'currency', currency: 'COP'}) : '-'}</TableCell>
                    <TableCell className="text-right">{payment.amountVES > 0 ? payment.amountVES.toLocaleString('es-VE', {style: 'currency', currency: 'VES'}) : '-'}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" onClick={() => onMarkAsPaid(payment.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        Marcar como Pagado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {memoizedPaymentTotals && (payments?.length ?? 0) > 0 && (
                <TableFooter>
                    {memoizedPaymentTotals.hasCOP && memoizedPaymentTotals.totalCOP > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2} className="text-right">TOTAL A PAGAR (COP)</TableCell>
                            <TableCell className="text-right font-extrabold">{memoizedPaymentTotals.totalCOP.toLocaleString('es-CO', {style: 'currency', currency: 'COP'})}</TableCell>
                            <TableCell colSpan={2} />
                        </TableRow>
                    )}
                    {memoizedPaymentTotals.hasVES && memoizedPaymentTotals.totalVES > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={3} className="text-right">TOTAL A PAGAR (VES)</TableCell>
                            <TableCell className="text-right font-extrabold">{memoizedPaymentTotals.totalVES.toLocaleString('es-VE', {style: 'currency', currency: 'VES'})}</TableCell>
                            <TableCell />
                        </TableRow>
                    )}
                    {memoizedPaymentTotals.totalUSD > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={4} className="text-right">TOTAL A PAGAR (USDT)</TableCell>
                            <TableCell className="text-right font-extrabold">${memoizedPaymentTotals.totalUSD.toFixed(2)}</TableCell>
                        </TableRow>
                    )}
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
    )
}


// Sub-component for Payment History Table
function PaymentHistoryTable({ payments, isLoading, onMarkAsUnpaid, onDelete }: { payments: Payment[] | null, isLoading: boolean, onMarkAsUnpaid: (id: string) => void, onDelete: (id: string) => void }) {
    
    const handleUndo = (id: string) => {
        onMarkAsUnpaid(id);
    }
    
    const handleDelete = (id: string) => {
        onDelete(id);
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Período de Pago</TableHead>
                    <TableHead>Publisher</TableHead>
                    <TableHead>Monto (USD)</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando historial...</TableCell></TableRow>}
                {!isLoading && payments?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay pagos registrados en este período.</TableCell></TableRow>}
                {payments?.map(payment => (
                    <TableRow key={payment.id}>
                        <TableCell>{formatPaymentPeriod(payment.paymentPeriod)}</TableCell>
                        <TableCell className="font-medium">{payment.publisherName}</TableCell>
                        <TableCell>${payment.amountUSD.toFixed(2)}</TableCell>
                        <TableCell>{payment.paidAt ? payment.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleUndo(payment.id)}>
                                        <Undo className="mr-2 h-4 w-4" />
                                        Marcar como No Pagado
                                    </DropdownMenuItem>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Eliminar Registro
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción eliminará permanentemente el registro de este pago. No se puede deshacer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-destructive hover:bg-destructive/90">
                                                    Sí, eliminar permanentemente
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
