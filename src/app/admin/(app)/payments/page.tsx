'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc, useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  Calculator, 
  Check, 
  Download, 
  Trash2, 
  History, 
  Undo, 
  CheckCheck,
  Search,
  Wallet,
  FileSpreadsheet
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

// Types
type Publisher = { id: string; firstName: string; lastName: string; paymentMethod?: string; country?: string; };
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
  reference?: string;
  paymentMethodUsed?: string;
};

// Form Schema for Payment Modal
const paymentRecordSchema = z.object({
  reference: z.string().min(1, "El número de referencia es requerido."),
  paymentMethodUsed: z.string().min(1, "El método de pago es requerido."),
});
type PaymentRecordData = z.infer<typeof paymentRecordSchema>;

const paymentFormSchema = z.object({
  month: z.string().nonempty("El mes es requerido."),
  year: z.string().nonempty("El año es requerido."),
  period: z.enum(['fortnight-1', 'fortnight-2']),
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];

export default function PayrollPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [paymentToRecord, setPaymentToRecord] = useState<Payment | null>(null);
  
  const [pendingPaymentPeriod, setPendingPaymentPeriod] = useState<string | null>(null);
  const [paidPaymentPeriod, setPaidPaymentPeriod] = useState<string | null>(null);
  
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  const { control, handleSubmit } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      period: 'fortnight-1',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    },
  });

  const pendingPaymentsQuery = useMemo(() => {
    if (!firestore || !pendingPaymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", pendingPaymentPeriod), where("status", "==", "pending"));
  }, [firestore, pendingPaymentPeriod]);
  
  const { data: pendingPayments, isLoading: isLoadingPending } = useCollection<Payment>(pendingPaymentsQuery);
  
  const paidPaymentsQuery = useMemo(() => {
    if (!firestore || !paidPaymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", paidPaymentPeriod), where("status", "==", "paid"));
  }, [firestore, paidPaymentPeriod]);
  
  const { data: paidPayments, isLoading: isLoadingPaid } = useCollection<Payment>(paidPaymentsQuery);

  const handleMarkAsPaid = async (data: PaymentRecordData) => {
    if (!firestore || !paymentToRecord) return;
    const paymentId = paymentToRecord.id;
    setProcessingPaymentId(paymentId);
    
    try {
        await updateDoc(doc(firestore, 'payments', paymentId), {
            status: 'paid',
            paidAt: serverTimestamp(),
            reference: data.reference,
            paymentMethodUsed: data.paymentMethodUsed
        });
        toast({ title: "Pago Registrado", description: "El trabajador ha pasado a estado SOLVENTE." });
        setPaymentToRecord(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo registrar el pago.' });
    } finally {
        setProcessingPaymentId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Registro de Pagos</h1>
        <p className="text-muted-foreground font-medium">Gestión de nómina y pre-liquidación automática</p>
      </div>

      <Tabs defaultValue="pending-payroll" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-8 w-full md:w-fit">
          <TabsTrigger value="pending-payroll" className="rounded-xl px-8 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Pre-nómina Quincenal
          </TabsTrigger>
          <TabsTrigger value="admin-validation" className="rounded-xl px-8 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <History className="mr-2 h-4 w-4" /> Validación y Archivo
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending-payroll">
          <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-2xl">Control de Liquidación</CardTitle>
              <CardDescription>Procesa los leads acumulados y genera la pre-nómina automática.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="grid md:grid-cols-3 gap-6 items-end p-6 rounded-2xl bg-muted/30 border border-border/40">
                <div className="space-y-2">
                  <Label className="font-bold">Año Fiscal</Label>
                  <Controller name="year" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {[2023, 2024, 2025].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Mes de Liquidación</Label>
                  <Controller name="month" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Período de Corte</Label>
                  <Controller name="period" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="fortnight-1">1ra Quincena (01-15)</SelectItem>
                        <SelectItem value="fortnight-2">2da Quincena (16-Fin)</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button onClick={handleSubmit(async (d) => {
                  setIsCalculating(true);
                  // Lógica de cálculo simplificada para el ejemplo
                  setPendingPaymentPeriod(`${d.year}-${d.month}-${d.period}`);
                  setIsCalculating(false);
                })} className="rounded-xl px-8 h-12 shadow-lg shadow-primary/20">
                  {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                  Procesar Datos Quincenales
                </Button>
                {pendingPaymentPeriod && (
                  <Button variant="outline" className="rounded-xl h-12 border-2" onClick={() => exportToPDF({
                    fileName: `Liquidacion_${pendingPaymentPeriod}.pdf`,
                    reportTitle: `Pre-nómina ${pendingPaymentPeriod}`
                  })}>
                    <Download className="mr-2 h-4 w-4" /> Exportar Reporte
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {pendingPaymentPeriod && (
            <div className="mt-8 space-y-6 animate-in slide-in-from-top-4 duration-500">
              <h3 className="text-xl font-bold px-2">Pendientes de Pago ({pendingPayments?.length || 0})</h3>
              <div className="grid gap-6">
                {pendingPayments?.map((payment) => (
                  <Card key={payment.id} className="rounded-2xl border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Users className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold">{payment.publisherName}</h4>
                          <div className="flex gap-4 mt-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período: {payment.paymentPeriod}</span>
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                              PENDIENTE
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="text-right">
                          <p className="text-xs font-bold text-muted-foreground uppercase">Monto Total</p>
                          <p className="text-2xl font-black text-primary">${payment.amountUSD.toFixed(2)}</p>
                        </div>
                        <Button 
                          onClick={() => setPaymentToRecord(payment)}
                          className="rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 h-12 px-6"
                        >
                          <Wallet className="mr-2 h-4 w-4" /> Registrar Pago
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {pendingPayments?.length === 0 && (
                  <div className="text-center p-12 bg-muted/20 rounded-2xl border-2 border-dashed">
                    <p className="text-muted-foreground font-medium">No hay pagos pendientes para este período.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="admin-validation">
          <Card className="rounded-2xl border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle>Historial y Auditoría</CardTitle>
              <CardDescription>Busca registros de pagos realizados para verificación o corrección.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2 col-span-1">
                  <Label>Año</Label>
                  <Select><SelectTrigger className="rounded-xl"><SelectValue placeholder="2025"/></SelectTrigger></Select>
                </div>
                <div className="space-y-2 col-span-1">
                  <Label>Mes</Label>
                  <Select><SelectTrigger className="rounded-xl"><SelectValue placeholder="Enero"/></SelectTrigger></Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Button className="w-full rounded-xl h-10"><Search className="mr-2 h-4 w-4" /> Buscar en Archivo</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Register Payment Modal */}
      <Dialog open={!!paymentToRecord} onOpenChange={(open) => !open && setPaymentToRecord(null)}>
        <DialogContent className="rounded-2xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Registrar Pago Realizado</DialogTitle>
            <CardDescription>
              Introduce los detalles de la transacción para {paymentToRecord?.publisherName}.
            </CardDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex justify-between items-center">
              <span className="font-bold text-muted-foreground uppercase text-xs">Monto a Liquidar</span>
              <span className="text-2xl font-black text-primary">${paymentToRecord?.amountUSD.toFixed(2)}</span>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Método de Pago Utilizado</Label>
                <Select onValueChange={(val) => {}}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar método"/></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="binance">Binance (USDT)</SelectItem>
                    <SelectItem value="pagomovil">Pago Móvil (VES)</SelectItem>
                    <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de Referencia / Comprobante</Label>
                <Input placeholder="Ej: 1234567890" className="rounded-xl" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="rounded-xl">Cancelar</Button></DialogClose>
            <Button 
              onClick={() => handleMarkAsPaid({ reference: 'REF-123', paymentMethodUsed: 'Binance' })} 
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
            >
              Confirmar y Archivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
