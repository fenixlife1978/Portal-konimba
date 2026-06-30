'use client';
import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useDoc, useUser, useFirestore, useStorage } from '@/firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Calculator, 
  Download, 
  History, 
  Search, 
  Wallet,
  FileSpreadsheet,
  Users,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToPDF } from '@/lib/export-pdf';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';

// Types
type Payment = {
  id: string;
  publisherId: string;
  publisherName: string;
  paymentPeriod: string;
  amountUSD: number;
  status: 'pending' | 'paid';
  createdAt: Timestamp;
  paidAt?: Timestamp;
  reference?: string;
  paymentMethodUsed?: string;
  captureUrl?: string;
};

// Form Schemas
const paymentRecordSchema = z.object({
  reference: z.string().min(1, "El número de referencia es requerido."),
  paymentMethodUsed: z.string().min(1, "El método de pago es requerido."),
  captureUrl: z.string().optional(),
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
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];

export default function PayrollPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [paymentToRecord, setPaymentToRecord] = useState<Payment | null>(null);
  
  const [pendingPaymentPeriod, setPendingPaymentPeriod] = useState<string | null>(null);
  const [archiveYear, setArchiveYear] = useState(String(new Date().getFullYear()));
  const [archiveMonth, setArchiveMonth] = useState(String(new Date().getMonth() + 1));
  const [archivePeriod, setArchivePeriod] = useState<string | null>(null);

  // Period Form
  const { control: periodControl, handleSubmit: handlePeriodSubmit } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      period: 'fortnight-1',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    },
  });

  // Payment Record Form
  const { 
    register: registerRecord, 
    handleSubmit: handleRecordSubmit, 
    setValue: setRecordValue, 
    watch: watchRecord,
    reset: resetRecord 
  } = useForm<PaymentRecordData>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: {
      reference: '',
      paymentMethodUsed: '',
      captureUrl: ''
    }
  });

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const start = 2023;
    return Array.from({ length: Math.max(current - start + 2, 5) }, (_, i) => start + i);
  }, []);

  // Queries
  const pendingPaymentsQuery = useMemo(() => {
    if (!firestore || !pendingPaymentPeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", pendingPaymentPeriod), where("status", "==", "pending"));
  }, [firestore, pendingPaymentPeriod]);
  const { data: pendingPayments } = useCollection<Payment>(pendingPaymentsQuery);
  
  const paidPaymentsQuery = useMemo(() => {
    if (!firestore || !archivePeriod) return null;
    return query(collection(firestore, "payments"), where("paymentPeriod", "==", archivePeriod), where("status", "==", "paid"));
  }, [firestore, archivePeriod]);
  const { data: paidPayments } = useCollection<Payment>(paidPaymentsQuery);

  const handleFileChange = async (file: File) => {
    if (!storage || !file) return;
    setIsUploading(true);
    const fileName = `captures/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, fileName);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on('state_changed', 
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => { 
        setIsUploading(false); 
        toast({ variant: "destructive", title: "Error", description: "No se pudo subir el comprobante." }); 
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(url => {
          setRecordValue('captureUrl', url);
          setIsUploading(false);
          toast({ title: "Comprobante cargado con éxito" });
        });
      }
    );
  };

  const onConfirmPayment = async (data: PaymentRecordData) => {
    if (!firestore || !paymentToRecord) return;
    setProcessingPaymentId(paymentToRecord.id);
    
    try {
        await updateDoc(doc(firestore, 'payments', paymentToRecord.id), {
            status: 'paid',
            paidAt: serverTimestamp(),
            reference: data.reference,
            paymentMethodUsed: data.paymentMethodUsed,
            captureUrl: data.captureUrl || null
        });
        toast({ title: "Pago Registrado", description: `${paymentToRecord.publisherName} ahora está SOLVENTE.` });
        setPaymentToRecord(null);
        resetRecord();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado del pago.' });
    } finally {
        setProcessingPaymentId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Registro de Pagos</h1>
        <p className="text-muted-foreground font-medium">Gestión de nómina y liquidación de trabajadores</p>
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
              <CardDescription>Selecciona un período para ver los pagos pendientes de proceso.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="grid md:grid-cols-3 gap-6 items-end p-6 rounded-2xl bg-muted/30 border border-border/40">
                <div className="space-y-2">
                  <Label className="font-bold">Año Fiscal</Label>
                  <Controller name="year" control={periodControl} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="rounded-xl bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Mes de Liquidación</Label>
                  <Controller name="month" control={periodControl} render={({ field }) => (
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
                  <Controller name="period" control={periodControl} render={({ field }) => (
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
                <Button onClick={handlePeriodSubmit((d) => {
                  setIsCalculating(true);
                  setPendingPaymentPeriod(`${d.year}-${d.month}-${d.period}`);
                  setIsCalculating(false);
                })} className="rounded-xl px-8 h-12 shadow-lg shadow-primary/20">
                  {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                  Cargar Datos del Período
                </Button>
              </div>
            </CardContent>
          </Card>

          {pendingPaymentPeriod && (
            <div className="mt-8 space-y-6 animate-in slide-in-from-top-4 duration-500">
              <h3 className="text-xl font-bold px-2">Pendientes de Pago ({pendingPayments?.length || 0})</h3>
              <div className="grid gap-4">
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
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto a liquidar</span>
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                              ESTADO: PENDIENTE
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="text-right">
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
                {pendingPayments?.length === 0 && !isCalculating && (
                  <div className="text-center p-12 bg-muted/20 rounded-2xl border-2 border-dashed">
                    <p className="text-muted-foreground font-medium">No se encontraron pagos pendientes en este período.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="admin-validation">
          <Card className="rounded-2xl border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle>Historial y Auditoría de Pagos</CardTitle>
              <CardDescription>Consulta los registros de trabajadores solventes por período.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Select onValueChange={setArchiveYear} value={archiveYear}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mes</Label>
                  <Select onValueChange={setArchiveMonth} value={archiveMonth}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quincena</Label>
                   <Select onValueChange={(val) => setArchivePeriod(`${archiveYear}-${archiveMonth}-${val}`)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="fortnight-1">1ra Quincena</SelectItem>
                        <SelectItem value="fortnight-2">2da Quincena</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Button className="w-full rounded-xl h-10" disabled={!archivePeriod}>
                    <Search className="mr-2 h-4 w-4" /> Buscar en Archivo
                  </Button>
                </div>
              </div>

              {archivePeriod && (
                <div className="border rounded-2xl overflow-hidden">
                   <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold">Trabajador</TableHead>
                        <TableHead className="font-bold">Monto</TableHead>
                        <TableHead className="font-bold">Método</TableHead>
                        <TableHead className="font-bold">Referencia</TableHead>
                        <TableHead className="font-bold">Fecha Pago</TableHead>
                        <TableHead className="text-right font-bold">Comprobante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidPayments?.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.publisherName}</TableCell>
                          <TableCell className="font-bold text-emerald-600">${p.amountUSD.toFixed(2)}</TableCell>
                          <TableCell className="capitalize">{p.paymentMethodUsed}</TableCell>
                          <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                          <TableCell className="text-xs">{p.paidAt?.toDate().toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            {p.captureUrl ? (
                              <Button asChild variant="ghost" size="sm">
                                <a href={p.captureUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {paidPayments?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                            No hay registros solventes para este período.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Register Payment Modal */}
      <Dialog open={!!paymentToRecord} onOpenChange={(open) => !open && setPaymentToRecord(null)}>
        <DialogContent className="rounded-2xl sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Confirmar Liquidación</DialogTitle>
            <DialogDescription>
              Registra los detalles del pago realizado a <b>{paymentToRecord?.publisherName}</b>.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleRecordSubmit(onConfirmPayment)} className="space-y-6 py-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex justify-between items-center">
              <span className="font-bold text-muted-foreground uppercase text-xs">Monto Total Liquidado</span>
              <span className="text-2xl font-black text-primary">${paymentToRecord?.amountUSD.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Método de Pago *</Label>
                <Select onValueChange={(val) => setRecordValue('paymentMethodUsed', val)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="binance">Binance (USDT)</SelectItem>
                    <SelectItem value="pagomovil">Pago Móvil (VES)</SelectItem>
                    <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                    <SelectItem value="efectivo">Efectivo / Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nº Referencia *</Label>
                <Input {...registerRecord('reference')} placeholder="Ej: 123456" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Capture o Comprobante (Opcional)</Label>
              {watchRecord('captureUrl') ? (
                <div className="flex items-center gap-4 p-3 border rounded-xl bg-emerald-50 text-emerald-700 border-emerald-100">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-xs font-bold truncate flex-1">Imagen cargada correctamente</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRecordValue('captureUrl', '')}>Cambiar</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileUpload onFileSelect={handleFileChange} disabled={isUploading} />
                  {isUploading && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground text-center font-bold">SUBIENDO ARCHIVO... {Math.round(uploadProgress)}%</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <DialogClose asChild><Button variant="ghost" className="rounded-xl">Cancelar</Button></DialogClose>
              <Button 
                type="submit"
                disabled={processingPaymentId !== null || isUploading}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 px-8"
              >
                {processingPaymentId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirmar y Archivar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
