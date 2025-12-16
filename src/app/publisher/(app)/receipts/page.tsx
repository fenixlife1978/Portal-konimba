'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, getDocs, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Download, FileText, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportToPDF } from '@/lib/export-pdf';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Payment = {
  id: string;
  publisherId: string;
  paymentPeriod: string;
  amountUSD: number;
  status: 'pending' | 'paid';
  paidAt: Timestamp;
};

type Lead = { 
  offerId: string;
  offerName: string;
  quantity: number; 
  date: string;
};
type Offer = { id: string; name: string; paymentAmount: number };
type Publisher = { firstName: string; lastName: string; email: string; };
type CompanySettings = { companyName?: string };

type ReceiptDetails = {
    leads: Lead[];
    offers: Map<string, Offer>;
};

export default function ReceiptsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'payments'), 
        where('publisherId', '==', user.uid), 
        where('status', '==', 'paid'),
        orderBy('paidAt', 'desc')
    );
  }, [firestore, user]);

  const { data: paidPayments, isLoading, error } = useCollection<Payment>(paymentsQuery);
  
  // This useEffect will help debug if there's a permission error from the hook
  useEffect(() => {
    if (error) {
      console.error("Error fetching paid payments:", error);
    }
  }, [error]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Mis Recibos de Pago</h1>
        <Button asChild variant="outline">
          <Link href="/publisher"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos Completados</CardTitle>
          <CardDescription>Aquí puedes ver y descargar los recibos de los pagos que has recibido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período de Pago</TableHead>
                <TableHead>Fecha de Pago</TableHead>
                <TableHead className="text-right">Monto (USD)</TableHead>
                <TableHead className="text-center">Recibo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center">Cargando recibos...</TableCell></TableRow>}
              {!isLoading && !paidPayments && error && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-destructive py-8">
                        Error al cargar los recibos. Revisa los permisos de Firestore.
                    </TableCell>
                </TableRow>
              )}
              {!isLoading && paidPayments?.length === 0 && !error ? (
                 <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No se encontraron recibos.</TableCell></TableRow>
              ) : (
                paidPayments?.map((payment) => (
                  <ReceiptRow key={payment.id} payment={payment} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {!isLoading && paidPayments?.length === 0 && !error && (
        <Alert className="mt-6">
            <Info className="h-4 w-4" />
            <AlertTitle>No hay recibos para mostrar</AlertTitle>
            <AlertDescription>
                Aún no has recibido ningún pago. Una vez que se complete un pago, tu recibo aparecerá aquí.
            </AlertDescription>
        </Alert>
      )}

    </div>
  );
}

function ReceiptRow({ payment }: { payment: Payment }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">{payment.paymentPeriod}</TableCell>
      <TableCell>{payment.paidAt ? format(payment.paidAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
      <TableCell className="text-right">${payment.amountUSD.toFixed(2)}</TableCell>
      <TableCell className="text-center">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Ver Recibo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
             <ReceiptDetailsDialog payment={payment} />
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function ReceiptDetailsDialog({ payment }: { payment: Payment }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [details, setDetails] = useState<ReceiptDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const publisherRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'publishers', user.uid) : null, [firestore, user]);
    const { data: publisherData } = useDoc<Publisher>(publisherRef);

    const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
    const { data: settingsData } = useDoc<CompanySettings>(settingsRef);


    useEffect(() => {
        if (!firestore || !user) return;
        
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const [year, month, periodType] = payment.paymentPeriod.split('-');
                const period = periodType === 'fortnight' ? `${periodType}-${payment.paymentPeriod.split('-')[2]}` : periodType;

                let startDay = 1, endDay = 15;
                if (period === 'fortnight-2') {
                    startDay = 16;
                    endDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                }
                const startDate = `${year}-${month.padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
                const endDate = `${year}-${month.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
                
                const leadsQuery = query(
                    collection(firestore, 'leads'),
                    where('publisherId', '==', user.uid),
                    where('date', '>=', startDate),
                    where('date', '<=', endDate)
                );
                const leadsSnapshot = await getDocs(leadsQuery);
                const leads = leadsSnapshot.docs.map(doc => doc.data() as Lead);

                const offerIds = [...new Set(leads.map(lead => lead.offerId))];
                const offers = new Map<string, Offer>();
                if(offerIds.length > 0) {
                    const offersQuery = query(collection(firestore, 'offers'), where('__name__', 'in', offerIds));
                    const offersSnapshot = await getDocs(offersQuery);
                    offersSnapshot.forEach(doc => offers.set(doc.id, { id: doc.id, ...doc.data() } as Offer));
                }
                
                setDetails({ leads, offers });
            } catch (error) {
                console.error("Error fetching receipt details: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();

    }, [firestore, user, payment.paymentPeriod, payment.publisherId]);

    const handleExport = async () => {
        if (!details || !publisherData) return;
        setIsExporting(true);
        const reportTitle = `Recibo de Pago - ${publisherData.firstName} ${publisherData.lastName}`;
        const fileName = `Recibo_${payment.paymentPeriod}_${publisherData.lastName}.pdf`;
        await exportToPDF('receipt-content', fileName, reportTitle, settingsData?.companyName);
        setIsExporting(false);
    };

    const earningsByOffer = new Map<string, { name: string, quantity: number, earnings: number }>();
    let totalLeads = 0;
    
    if (details) {
        details.leads.forEach(lead => {
            const offer = details.offers.get(lead.offerId);
            if (offer) {
                const earning = lead.quantity * offer.paymentAmount;
                const current = earningsByOffer.get(lead.offerId) || { name: offer.name, quantity: 0, earnings: 0 };
                current.quantity += lead.quantity;
                current.earnings += earning;
                earningsByOffer.set(lead.offerId, current);
            }
        });
        totalLeads = Array.from(earningsByOffer.values()).reduce((sum, item) => sum + item.quantity, 0);
    }
    
    if (isLoading || !publisherData) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <span>Cargando detalles del recibo...</span>
            </div>
        );
    }

    return (
        <div id="receipt-content" className="p-2">
            <header className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">Recibo de Pago</h2>
                <p className="text-muted-foreground">Período de pago: {payment.paymentPeriod}</p>
                <div className="mt-4 flex justify-between items-end">
                    <div>
                        <p className="font-semibold">{publisherData.firstName} {publisherData.lastName}</p>
                        <p className="text-sm text-muted-foreground">{publisherData.email}</p>
                    </div>
                    <div>
                        <p className="text-sm">Fecha de Pago: {payment.paidAt ? format(payment.paidAt.toDate(), 'PPP', { locale: es }) : 'N/A'}</p>
                        <p className="text-sm">Estado: <Badge variant="default">Pagado</Badge></p>
                    </div>
                </div>
            </header>
            
            <Separator className="my-6" />

            <main>
                <h3 className="font-semibold mb-4 text-lg">Resumen de Liquidación</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Oferta</TableHead>
                            <TableHead className="text-right">Leads Generados</TableHead>
                            <TableHead className="text-right">Monto de Ganancia (USD)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from(earningsByOffer.entries()).map(([offerId, data]) => (
                            <TableRow key={offerId}>
                                <TableCell>{data.name}</TableCell>
                                <TableCell className="text-right">{data.quantity}</TableCell>
                                <TableCell className="text-right">${data.earnings.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="mt-6 flex justify-end">
                    <div className="w-full max-w-sm space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Leads</span>
                            <span>{totalLeads}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total Pagado (USD)</span>
                            <span>${payment.amountUSD.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </main>
             <footer className="mt-8 flex justify-end gap-2">
                <Button onClick={handleExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar a PDF
                </Button>
            </footer>
        </div>
    );
}
