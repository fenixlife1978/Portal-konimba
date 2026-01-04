'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc, useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Calculator, Check, Download, FileText, Trash2, FolderDown } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

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

export default function PaymentsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isCalculating, setIsCalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [paymentPeriod, setPaymentPeriod] = useState<string | null>(null);
  
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);
  
  const paymentsQuery = useMemo(() => {
    if (!firestore || !paymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", paymentPeriod), where("status", "==", "pending"));
  }, [firestore, paymentPeriod]);
  
  const { data: pendingPayments, isLoading: isLoadingPayments, error: paymentsError } = useCollection<Payment>(paymentsQuery);
  
  const publishersRef = useMemo(() => (firestore && user) ? collection(firestore, 'publishers') : null, [firestore, user]);
  const { data: publishersData } = useCollection<Publisher>(publishersRef);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<PaymentFormData>({
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
  
  const memoizedPaymentTotals = useMemo((): PaymentTotals | null => {
    if (!pendingPayments) return null;

    return pendingPayments.reduce((totals, payment) => {
        // Publisher will be paid in VES
        if (payment.amountVES > 0) {
            totals.totalVES += payment.amountVES;
            totals.hasVES = true;
        } 
        // Publisher will be paid in COP
        else if (payment.amountCOP > 0) {
            totals.totalCOP += payment.amountCOP;
            totals.hasCOP = true;
        } 
        // Publisher will be paid in USDT (USD)
        else {
            totals.totalUSD += payment.amountUSD;
        }
        return totals;
    }, { totalUSD: 0, totalVES: 0, totalCOP: 0, hasVES: false, hasCOP: false });
  }, [pendingPayments]);

  const handleCalculateAndSave = async (data: PaymentFormData) => {
     if (!firestore || !publishersData) return;
    setIsCalculating(true);
    setPaymentPeriod(null);

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
            let amountUSD = earnings.total;

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
    setPaymentPeriod(currentPaymentPeriod);
    toast({
        title: "Cargando Nómina",
        description: `Buscando pagos pendientes para el período ${formatPaymentPeriod(currentPaymentPeriod)}.`
    })
  };
  
  const handleDeletePeriod = async () => {
    if (!firestore || !paymentPeriod) {
        toast({ variant: "destructive", title: "Error", description: "No hay un período seleccionado para eliminar." });
        return;
    }
    setIsDeleting(true);

    try {
        const paymentsToDeleteQuery = query(collection(firestore, "payments"), where("paymentPeriod", "==", paymentPeriod), where("status", "==", "pending"));
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
        setPaymentPeriod(null); // Clear the view

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
    toast({ title: "Pago Confirmado", description: "El pago ha sido marcado como completado." });
  };

  const handleExport = async () => {
    if (!pendingPayments || pendingPayments.length === 0 || !paymentPeriod) return;
    setIsExporting(true);

    const formattedPeriod = formatPaymentPeriod(paymentPeriod);
    const reportTitle = `Nómina de Pagos Pendientes - ${formattedPeriod}`;
    const fileName = `Nomina_Pagos_${paymentPeriod}.pdf`;

    const columns = ['Publisher', 'Monto (USD)', 'Monto (COP)', 'Monto (VES)'];
    const data = pendingPayments.map(p => [
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
  
  const formatPaymentPeriod = (period: string | null) => {
    if (!period) return '';
    const parts = period.split('-');
    const year = parts[0];
    const month = months.find(m => m.value === parts[1])?.label;
    const fortnight = period.endsWith('fortnight-1') ? 'quincena 1' : 'quincena 2';
    return `${year}-${month} - ${fortnight}`;
  };

  const watchedValues = watch();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Pagos</h1>
        <Button asChild variant="outline">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

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
                    <Button variant="destructive" disabled={!paymentPeriod || (pendingPayments && pendingPayments.length === 0)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Nómina Pendiente
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de que deseas eliminar esta nómina?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción eliminará todos los pagos pendientes para el período <span className="font-bold">{formatPaymentPeriod(paymentPeriod)}</span>. Esta operación no se puede deshacer.
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
      
      {paymentsError && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error de Firestore</AlertTitle>
          <AlertDescription>No se pudieron cargar los pagos. Es posible que necesites crear un índice compuesto en Firestore. Revisa la consola para más detalles.</AlertDescription>
        </Alert>
      )}

      {paymentPeriod && (
        <Card className="mt-8" id="payments-table-container">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Pagos Pendientes para el Período: {formatPaymentPeriod(paymentPeriod)}</CardTitle>
                    <CardDescription>Lista de publishers con pagos por procesar para el período seleccionado.</CardDescription>
                </div>
                 <Button onClick={handleExport} variant="outline" disabled={isExporting || !pendingPayments || pendingPayments.length === 0}>
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
                {isLoadingPayments && <TableRow><TableCell colSpan={5} className="text-center">Cargando pagos pendientes...</TableCell></TableRow>}
                {!isLoadingPayments && pendingPayments?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay pagos pendientes para este período.</TableCell></TableRow>}
                {pendingPayments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.publisherName}</TableCell>
                    <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{payment.amountCOP > 0 ? payment.amountCOP.toLocaleString('es-CO', {style: 'currency', currency: 'COP'}) : '-'}</TableCell>
                    <TableCell className="text-right">{payment.amountVES > 0 ? payment.amountVES.toLocaleString('es-VE', {style: 'currency', currency: 'VES'}) : '-'}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" onClick={() => handleMarkAsPaid(payment.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        Marcar como Pagado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {memoizedPaymentTotals && (pendingPayments?.length ?? 0) > 0 && (
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
      )}

    </div>
  );
}
