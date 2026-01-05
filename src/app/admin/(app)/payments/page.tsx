'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc, useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Calculator, Check, Download, Trash2, FolderDown, History, Undo, CheckCheck } from 'lucide-react';
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
import { MoreHorizontal } from 'lucide-react';


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
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  
  const [pendingPaymentPeriod, setPendingPaymentPeriod] = useState<string | null>(null);
  const [paidPaymentPeriod, setPaidPaymentPeriod] = useState<string | null>(null);
  
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);
  
  const publishersRef = useMemo(() => (firestore && user) ? collection(firestore, 'publishers') : null, [firestore, user]);
  const { data: publishersData } = useCollection<Publisher>(publishersRef);

  const pendingPaymentsQuery = useMemo(() => {
    if (!firestore || !pendingPaymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", pendingPaymentPeriod), where("status", "==", "pending"));
  }, [firestore, pendingPaymentPeriod]);
  
  const { data: pendingPayments, isLoading: isLoadingPending, error: pendingError } = useCollection<Payment>(pendingPaymentsQuery);
  
  const paidPaymentsQuery = useMemo(() => {
    if (!firestore || !paidPaymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", paidPaymentPeriod), where("status", "==", "paid"));
  }, [firestore, paidPaymentPeriod]);
  
  const { data: paidPayments, isLoading: isLoadingPaid, error: paidError } = useCollection<Payment>(paidPaymentsQuery);


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
                amountUSD: earnings.total,
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

  const handleLoadPendingPeriod = (data: PaymentFormData) => {
    const { currentPaymentPeriod } = getPeriodData(data);
    setPendingPaymentPeriod(currentPaymentPeriod);
    toast({
        title: "Cargando Nómina Pendiente",
        description: `Buscando pagos pendientes para ${formatPaymentPeriod(currentPaymentPeriod)}.`
    })
  };

  const handleLoadPaidPeriod = (data: PaymentFormData) => {
    const { currentPaymentPeriod } = getPeriodData(data);
    setPaidPaymentPeriod(currentPaymentPeriod);
    toast({
        title: "Cargando Historial",
        description: `Buscando pagos realizados para ${formatPaymentPeriod(currentPaymentPeriod)}.`
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
  
  const handleMarkAsPaid = async (paymentId: string) => {
    if (!firestore) return;
    setProcessingPaymentId(paymentId);
    const paymentRef = doc(firestore, 'payments', paymentId);
    try {
        await updateDoc(paymentRef, {
            status: 'paid',
            paidAt: serverTimestamp(),
        });
        toast({ title: "Pago Confirmado", description: "El pago se ha marcado como pagado." });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el pago.' });
    } finally {
        setProcessingPaymentId(null);
    }
  };
  
  const handleMarkAllAsPaid = async (paymentsToUpdate: Payment[] | null) => {
    if (!firestore || !paymentsToUpdate || paymentsToUpdate.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No hay pagos pendientes para marcar.' });
      return;
    }

    const batch = writeBatch(firestore);
    paymentsToUpdate.forEach(payment => {
      const paymentRef = doc(firestore, 'payments', payment.id);
      batch.update(paymentRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
      });
    });

    try {
      await batch.commit();
      toast({ title: 'Nómina Procesada', description: `Se marcaron ${paymentsToUpdate.length} pagos como realizados.` });
    } catch (error: any) {
      console.error('Error marking all as paid:', error);
      toast({ variant: 'destructive', title: 'Error al procesar la nómina', description: error.message });
    }
  };


  const handleRevertToPending = (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    updateDocumentNonBlocking(paymentRef, {
        status: 'pending',
        paidAt: null,
    });
    toast({ title: "Pago Revertido", description: "El pago se ha marcado como pendiente." });
  };

  const handleDeletePaymentRecord = (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    deleteDocumentNonBlocking(paymentRef);
    toast({ title: "Registro de Pago Eliminado", description: "El registro ha sido eliminado permanentemente." });
  };

  
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Pagos</h1>
        <Button asChild variant="outline">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

    <Tabs defaultValue="pending-payroll">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending-payroll">Nómina de Pagos</TabsTrigger>
          <TabsTrigger value="admin-validation">Validación Administrativa</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending-payroll">
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
                        <Label htmlFor="year-pending">Año</Label>
                        <Controller name="year" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="year-pending"><SelectValue placeholder="Año" /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="month-pending">Mes</Label>
                        <Controller name="month" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="month-pending"><SelectValue placeholder="Mes" /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="period-pending">Quincena</Label>
                        <Controller name="period" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="period-pending"><SelectValue placeholder="Quincena" /></SelectTrigger>
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
                        <Button onClick={handleSubmit(handleLoadPendingPeriod)} variant="secondary">
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
                <AlertDescription>No se pudieron cargar los pagos pendientes. Es posible que necesites crear un índice compuesto en Firestore. Revisa la consola para más detalles.</AlertDescription>
                </Alert>
            )}

            {pendingPaymentPeriod && (
                <PendingPaymentsTable 
                    payments={pendingPayments}
                    isLoading={isLoadingPending}
                    period={pendingPaymentPeriod}
                    settingsData={settingsData}
                    onMarkAsPaid={handleMarkAsPaid}
                    onMarkAllAsPaid={() => handleMarkAllAsPaid(pendingPayments)}
                    processingPaymentId={processingPaymentId}
                />
            )}
        </TabsContent>
        
        <TabsContent value="admin-validation">
            <Card>
                <CardHeader>
                    <CardTitle>Historial y Validación de Pagos</CardTitle>
                    <CardDescription>
                        Busca pagos ya realizados para consultarlos o revertir su estado si fue un error.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 items-end">
                       <div className="space-y-2">
                        <Label htmlFor="year-paid">Año</Label>
                        <Controller name="year" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="year-paid"><SelectValue placeholder="Año" /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="month-paid">Mes</Label>
                        <Controller name="month" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="month-paid"><SelectValue placeholder="Mes" /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="period-paid">Quincena</Label>
                        <Controller name="period" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="period-paid"><SelectValue placeholder="Quincena" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fortnight-1">1ra Quincena</SelectItem>
                                <SelectItem value="fortnight-2">2da Quincena</SelectItem>
                            </SelectContent>
                            </Select>
                        )} />
                        </div>
                    </div>
                     <div className="flex flex-wrap gap-2 mt-4">
                         <Button onClick={handleSubmit(handleLoadPaidPeriod)}>
                            <History className="mr-2 h-4 w-4" />
                            Buscar Pagos Realizados
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {paidError && (
                <Alert variant="destructive" className="mt-4">
                <AlertTitle>Error de Firestore</AlertTitle>
                <AlertDescription>No se pudieron cargar los pagos realizados. Es posible que necesites crear un índice compuesto en Firestore. Revisa la consola para más detalles.</AlertDescription>
                </Alert>
            )}

            {paidPaymentPeriod && (
                <PaidPaymentsTable 
                    payments={paidPayments}
                    isLoading={isLoadingPaid}
                    period={paidPaymentPeriod}
                    onRevertToPending={handleRevertToPending}
                    onDeletePayment={handleDeletePaymentRecord}
                />
            )}
        </TabsContent>
    </Tabs>
    </div>
  );
}


function PendingPaymentsTable({ payments, isLoading, period, settingsData, onMarkAsPaid, onMarkAllAsPaid, processingPaymentId }: { payments: Payment[] | null, isLoading: boolean, period: string, settingsData: CompanySettings | null, onMarkAsPaid: (id: string) => void, onMarkAllAsPaid: () => void, processingPaymentId: string | null }) {
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
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <CardTitle>Pagos Pendientes para: {formatPaymentPeriod(period)}</CardTitle>
                    <CardDescription>Lista de publishers con pagos por procesar.</CardDescription>
                </div>
                 <div className="flex gap-2">
                    <Button onClick={handleExport} variant="outline" disabled={isExporting || !payments || payments.length === 0}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar a PDF
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="default" disabled={!payments || payments.length === 0}>
                                <CheckCheck className="mr-2 h-4 w-4" />
                                Marcar Todo como Pagado
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Confirmar Nómina Completa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Estás a punto de marcar los {payments?.length || 0} pagos de esta nómina como realizados. Esta acción no se puede revertir fácilmente. ¿Estás seguro?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={onMarkAllAsPaid}>
                                    Sí, confirmar y procesar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
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
                      <Button 
                        size="sm" 
                        onClick={() => onMarkAsPaid(payment.id)} 
                        disabled={processingPaymentId === payment.id}
                      >
                         {processingPaymentId === payment.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        {processingPaymentId === payment.id ? 'Procesando...' : 'Marcar como Pagado'}
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

function PaidPaymentsTable({ payments, isLoading, period, onRevertToPending, onDeletePayment }: { payments: Payment[] | null, isLoading: boolean, period: string, onRevertToPending: (id: string) => void, onDeletePayment: (id: string) => void }) {
    
    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Historial de Pagos para: {formatPaymentPeriod(period)}</CardTitle>
                <CardDescription>Pagos ya procesados. Desde aquí puedes revertirlos a "pendientes" si hubo un error.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Publisher</TableHead>
                            <TableHead>Fecha de Pago</TableHead>
                            <TableHead className="text-right">Monto (USD)</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={4} className="text-center">Cargando historial...</TableCell></TableRow>}
                        {!isLoading && payments?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No hay pagos realizados para este período.</TableCell></TableRow>}
                        {payments?.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell className="font-medium">{payment.publisherName}</TableCell>
                                <TableCell>{payment.paidAt ? payment.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'}</TableCell>
                                <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => onRevertToPending(payment.id)}>
                                                <Undo className="mr-2 h-4 w-4" />
                                                Revertir a Pendiente
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
                                                        <AlertDialogTitle>¿Confirmas la eliminación?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                          Esta acción eliminará permanentemente el registro de pago para <span className="font-bold">{payment.publisherName}</span>. No se puede deshacer.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onDeletePayment(payment.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                            Sí, eliminar
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
            </CardContent>
        </Card>
    );
}
