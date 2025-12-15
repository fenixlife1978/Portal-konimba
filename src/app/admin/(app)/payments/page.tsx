'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Calculator, Check, Download, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToPDF } from '@/lib/export-pdf';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Types
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
  const { toast } = useToast();

  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [paymentPeriod, setPaymentPeriod] = useState<string | null>(null);
  
  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);
  
  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !paymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", paymentPeriod), where("status", "==", "pending"));
  }, [firestore, paymentPeriod]);
  
  const { data: pendingPayments, isLoading: isLoadingPayments, error: paymentsError } = useCollection<Payment>(paymentsQuery);

  const { control, handleSubmit, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      period: 'fortnight-1',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    if (!firestore) return;
    setIsCalculating(true);
    
    const { month, year, period } = data;
    const currentPaymentPeriod = `${year}-${month}-${period}`;
    setPaymentPeriod(currentPaymentPeriod);

    try {
      // Check if payments for this period are already generated
      const existingPaymentsQuery = query(collection(firestore, "payments"), where("paymentPeriod", "==", currentPaymentPeriod), where("status", "==", "pending"));
      const existingPaymentsSnapshot = await getDocs(existingPaymentsQuery);

      if (!existingPaymentsSnapshot.empty) {
        toast({ title: "Cálculo Omitido", description: "Los pagos para este período ya han sido calculados y están pendientes." });
        setIsCalculating(false);
        return;
      }
      
      let startDay = 1;
      let endDay = 15;
      if (period === 'fortnight-2') {
        startDay = 16;
        endDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      }
      const startDate = `${year}-${month.padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      const endDate = `${year}-${month.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
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

      for (const [publisherId, earnings] of earningsByPublisher.entries()) {
        const paymentData = {
          publisherId,
          publisherName: earnings.name,
          paymentPeriod: currentPaymentPeriod,
          amountUSD: earnings.total,
          amountVES: earnings.total * usdToVes,
          amountCOP: earnings.total * usdToCop,
          status: 'pending',
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(firestore, 'payments'), paymentData);
      }

      toast({ title: "Cálculo de Pagos Exitoso", description: `Se han generado ${earningsByPublisher.size} pagos pendientes.` });

    } catch (error: any) {
      console.error("Payment calculation error", error);
      toast({ variant: "destructive", title: "Error al Calcular Pagos", description: error.message });
    } finally {
      setIsCalculating(false);
    }
  };
  
  const handleMarkAsPaid = async (paymentId: string) => {
    if (!firestore) return;
    try {
        const paymentRef = doc(firestore, 'payments', paymentId);
        await updateDoc(paymentRef, {
            status: 'paid',
            paidAt: serverTimestamp(),
        });
        toast({ title: "Pago Confirmado", description: "El pago ha sido marcado como completado." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error al confirmar pago", description: error.message });
    }
  };

  const handleExport = async () => {
    if (!pendingPayments || pendingPayments.length === 0 || !paymentPeriod) return;
    setIsExporting(true);
    const formattedPeriod = paymentPeriod.replace('fortnight-1', 'quincena 1').replace('fortnight-2', 'quincena 2');
    const reportTitle = `Nómina de Pagos Pendientes - ${formattedPeriod}`;
    const fileName = `Nomina_Pagos_${paymentPeriod}.pdf`;
    await exportToPDF('payments-table', fileName, reportTitle, settingsData?.companyName);
    setIsExporting(false);
  };
  
  const formatPaymentPeriod = (period: string | null) => {
    if (!period) return '';
    return period
      .replace('fortnight-1', ' - quincena 1')
      .replace('fortnight-2', ' - quincena 2');
  };

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
          <CardTitle>Calcular Pagos de Quincena</CardTitle>
          <CardDescription>
            Selecciona un período para calcular y generar los pagos pendientes de los publishers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid md:grid-cols-4 gap-4 items-end">
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
            <Button type="submit" disabled={isCalculating}>
              {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              {isCalculating ? 'Calculando...' : 'Calcular Pagos'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {paymentsError && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error de Firestore</AlertTitle>
          <AlertDescription>No se pudieron cargar los pagos. Es posible que necesites crear un índice compuesto en Firestore. Revisa la consola para más detalles.</AlertDescription>
        </Alert>
      )}

      {paymentPeriod && (
        <Card className="mt-8" id="payments-table">
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
                  <TableHead className="text-right">Monto (USDT)</TableHead>
                  <TableHead className="text-right">Monto (COP)</TableHead>
                  <TableHead className="text-right">Monto (VES)</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPayments && <TableRow><TableCell colSpan={6} className="text-center">Cargando pagos pendientes...</TableCell></TableRow>}
                {!isLoadingPayments && pendingPayments?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No hay pagos pendientes para este período.</TableCell></TableRow>}
                {pendingPayments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.publisherName}</TableCell>
                    <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{payment.amountCOP.toLocaleString('es-CO', {style: 'currency', currency: 'COP'})}</TableCell>
                    <TableCell className="text-right">{payment.amountVES.toLocaleString('es-VE', {style: 'currency', currency: 'VES'})}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" onClick={() => handleMarkAsPaid(payment.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        Marcar como Pagado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
