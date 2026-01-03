'use client';
import { useMemo, useState }from 'react';
import { useCollection, useUser, useDoc } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, doc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// Types
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

type CompanySettings = {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companySocialMedia?: string;
  logoUrl?: string;
  usdToVesRate?: number;
  usdToCopRate?: number;
};

type Publisher = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
};

const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];

const formatPaymentPeriod = (period: string | null) => {
    if (!period) return '';
    const parts = period.split('-');
    const year = parts[0];
    const month = months.find(m => m.value === parts[1])?.label;
    const fortnight = period.endsWith('fortnight-1') ? '1ra quincena' : '2da quincena';
    return `${month} ${year} - ${fortnight}`;
};

function ReceiptDetails({ payment, publisher, settings }: { payment: Payment, publisher: Publisher, settings: CompanySettings | null }) {
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);
    
    let rate = 0;
    let localAmount = 0;
    let localCurrency = '';
    
    if (payment.amountVES > 0 && settings?.usdToVesRate) {
        rate = settings.usdToVesRate;
        localAmount = payment.amountVES;
        localCurrency = 'VES';
    } else if (payment.amountCOP > 0 && settings?.usdToCopRate) {
        rate = settings.usdToCopRate;
        localAmount = payment.amountCOP;
        localCurrency = 'COP';
    }

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const margin = 15;
            const docWidth = doc.internal.pageSize.getWidth();
            let y = 20;

            // Header
            if (settings?.logoUrl) {
                 try {
                    const response = await fetch(settings.logoUrl);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    await new Promise<void>(resolve => {
                       reader.onloadend = () => {
                        doc.addImage(reader.result as string, 'PNG', margin, 15, 30, 30);
                        resolve();
                       }
                    });
                } catch (e) { console.error("Error loading logo for PDF", e); }
            }
            
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(settings?.companyName || 'Recibo de Pago', docWidth - margin, 25, { align: 'right' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(settings?.companyAddress || '', docWidth - margin, 32, { align: 'right' });
            doc.text(settings?.companyEmail || '', docWidth - margin, 37, { align: 'right' });
            doc.text(settings?.companyPhone || '', docWidth - margin, 42, { align: 'right' });
            
            y = 60;
            doc.setLineWidth(0.5);
            doc.line(margin, y - 5, docWidth - margin, y - 5);

            // Receipt Info
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Recibo de Pago', margin, y);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Fecha de Pago: ${payment.paidAt ? payment.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'}`, docWidth - margin, y, { align: 'right' });
            y += 8;

            // Publisher Info
            doc.text(`Publisher: ${publisher.firstName} ${publisher.lastName}`, margin, y);
            doc.text(`Email: ${publisher.email}`, margin, y + 5);
            y += 15;
            
            // Body
            autoTable(doc, {
                startY: y,
                theme: 'grid',
                head: [['Concepto', 'Período', 'Monto (USD)']],
                body: [['Ganancias Obtenidas en este periodo.', formatPaymentPeriod(payment.paymentPeriod), `$${payment.amountUSD.toFixed(2)}`]],
                headStyles: { fillColor: [22, 64, 114] }
            });
            
            y = (doc as any).lastAutoTable.finalY + 15;

            // Payment Details
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalles del Pago', margin, y);
            y += 8;

            let paymentDetailsBody: any[][] = [];
            if (localCurrency) {
                 paymentDetailsBody.push(['Monto en USD:', `$${payment.amountUSD.toFixed(2)}`]);
                 paymentDetailsBody.push([`Tasa de Cambio (${localCurrency}/USD):`, rate.toFixed(2)]);
                 paymentDetailsBody.push([{ content: `Monto Total Pagado (${localCurrency}):`, styles: { fontStyle: 'bold' }}, { content: `${localAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${localCurrency}`, styles: { fontStyle: 'bold' } }]);
            } else {
                 paymentDetailsBody.push(['Monto en USD (USDT):', `$${payment.amountUSD.toFixed(2)}`]);
                 paymentDetailsBody.push([{content: 'Método de Pago:', styles: { fontStyle: 'bold' }}, { content: 'Criptomoneda (USDT)', styles: { fontStyle: 'bold' }}]);
            }

            autoTable(doc, {
                startY: y,
                theme: 'plain',
                body: paymentDetailsBody,
            });

            doc.save(`Recibo_${payment.paymentPeriod}.pdf`);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error al exportar', description: error.message });
        } finally {
            setIsExporting(false);
        }
    };


    return (
        <div>
            <DialogHeader>
                <div className="flex items-center gap-4">
                    {settings?.logoUrl && <Image src={settings.logoUrl} alt="Logo" width={64} height={64} className="rounded-md" />}
                    <div>
                        <DialogTitle>Recibo de Pago - {settings?.companyName}</DialogTitle>
                        <DialogDescription>
                            Período: {formatPaymentPeriod(payment.paymentPeriod)}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <div className="py-6 space-y-6">
                <div className="text-sm">
                    <p><strong>Fecha de Pago:</strong> {payment.paidAt ? payment.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'}</p>
                    <p><strong>Publisher:</strong> {publisher.firstName} {publisher.lastName}</p>
                    <p><strong>Email:</strong> {publisher.email}</p>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Ganancias Obtenidas en este periodo.</TableCell>
                            <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <Card>
                    <CardHeader><CardTitle className="text-base">Resumen del Pago</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-2">
                        {localCurrency ? (
                            <>
                             <div className="flex justify-between"><span>Monto en USD:</span> <strong>${payment.amountUSD.toFixed(2)}</strong></div>
                             <div className="flex justify-between"><span>Tasa de Cambio Aplicada:</span> <strong>{rate.toFixed(2)} {localCurrency}/USD</strong></div>
                             <div className="flex justify-between text-base font-bold text-primary pt-2 border-t mt-2"><span>Total Pagado en {localCurrency}:</span> <span>{localAmount.toLocaleString('es-VE', {minimumFractionDigits: 2})} {localCurrency}</span></div>
                            </>
                        ) : (
                             <>
                              <div className="flex justify-between"><span>Monto Pagado:</span> <strong>${payment.amountUSD.toFixed(2)}</strong></div>
                              <div className="flex justify-between"><span>Moneda:</span> <strong>USDT (Criptomoneda)</strong></div>
                             </>
                        )}
                    </CardContent>
                </Card>

            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
                <Button onClick={handleExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar a PDF
                </Button>
            </DialogFooter>
        </div>
    )
}


export default function ReceiptsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = db;

  const paidPaymentsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, "payments"), 
        where("publisherId", "==", user.uid),
        where("status", "==", "paid"),
        orderBy("paidAt", "desc")
    );
  }, [firestore, user]);
  
  const { data: payments, isLoading, error } = useCollection<Payment>(paidPaymentsQuery);
  
  const { data: publisherData, isLoading: isLoadingPublisher } = useDoc<Publisher>(
      useMemo(() => (user ? doc(db, 'publishers', user.uid) : null), [user])
  );

  const { data: settingsData } = useDoc<CompanySettings>(
      useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore])
  );
  
  const isLoadingPage = isUserLoading || isLoading || isLoadingPublisher;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Mis Recibos de Pago</h1>
        <Button asChild variant="outline">
          <Link href="/publisher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

        {isLoadingPage && (
            <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Cargando tus recibos...</p>
            </div>
        )}

      {error && (
        <Card className="bg-destructive/10 border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive">Error al cargar recibos</CardTitle>
                <CardDescription className="text-destructive/80">
                    No pudimos cargar tus recibos de pago. Es posible que necesites un índice compuesto en Firestore.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">{error.message}</p>
            </CardContent>
        </Card>
      )}

      {!isLoadingPage && !error && (
        <>
          {(!payments || payments.length === 0) ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h3 className="text-xl font-semibold text-muted-foreground">No tienes recibos disponibles</h3>
                <p className="text-muted-foreground mt-2">Cuando se procese un pago, tu recibo aparecerá aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {payments.map((payment) => (
                    <Card key={payment.id}>
                        <CardHeader>
                            <CardTitle>Período: {formatPaymentPeriod(payment.paymentPeriod)}</CardTitle>
                            <CardDescription>
                                Pagado el: {payment.paidAt ? payment.paidAt.toDate().toLocaleDateString('es-VE') : 'N/A'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-primary">${payment.amountUSD.toFixed(2)}</p>
                        </CardContent>
                        <CardFooter>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full">
                                        <Eye className="mr-2 h-4 w-4" />
                                        Ver y Exportar Recibo
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl">
                                    {publisherData && settingsData ? (
                                        <ReceiptDetails payment={payment} publisher={publisherData} settings={settingsData} />
                                    ) : <Loader2 className="h-8 w-8 animate-spin mx-auto"/>}
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
