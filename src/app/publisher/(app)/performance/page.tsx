'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Types
type Publisher = { id: string; firstName: string; lastName: string; email: string; };
type Offer = { id: string; name: string; paymentAmount: number; };
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

type ReportData = {
  leads: Lead[];
  offersMap: Map<string, Offer>;
  daysInPeriod: number[];
  periodLabel: string;
}

const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', 'label': 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', 'label': 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', 'label': 'Noviembre' }, { value: '12', 'label': 'Diciembre' }
];


export default function PerformancePage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const publisherRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'publishers', user.uid) : null, [firestore, user]);
  const { data: publisherData, isLoading: isLoadingPublisher } = useDoc<Publisher>(publisherRef);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (isUserLoading || !user || !firestore || !publisherData) {
      return;
    }

    const generateReport = async () => {
      setIsGenerating(true);
      
      const now = new Date();
      const month = String(now.getMonth() + 1);
      const year = String(now.getFullYear());
      const currentDay = now.getDate();

      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

      try {
        const leadsQuery = query(
          collection(firestore, 'leads'),
          where('publisherId', '==', user.uid),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc')
        );
        const leadsSnapshot = await getDocs(leadsQuery);
        const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));

        if (leads.length === 0) {
          toast({ title: "Sin actividad reciente", description: "Aún no has generado leads este mes." });
          setReportData(null);
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
        const periodLabel = `Rendimiento de ${months.find(m => m.value === month)?.label} ${year} (hasta hoy)`;
        const daysInPeriod = Array.from({ length: currentDay }, (_, i) => i + 1);
        
        setReportData({ leads, offersMap, daysInPeriod, periodLabel });

      } catch (error: any) {
        console.error("Report Generation Error:", error);
        toast({
          variant: "destructive",
          title: "Error al generar reporte",
          description: error.message || "No se pudieron obtener tus datos de rendimiento.",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generateReport();
  }, [user, isUserLoading, firestore, toast, publisherData]);


  if (isGenerating || isLoadingPublisher || isUserLoading) {
    return (
        <div className="flex items-center justify-center pt-16">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p className="text-lg">Cargando tu rendimiento...</p>
        </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Mi Rendimiento
        </h1>
        <Button asChild variant="outline">
          <Link href="/publisher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

       {reportData && publisherData ? (
           <ReportDisplay reportData={reportData} publisher={publisherData} period={reportData.periodLabel} />
       ) : (
           <Card>
               <CardHeader>
                   <CardTitle>Sin Datos de Rendimiento</CardTitle>
                   <CardDescription>No hemos encontrado leads generados por ti en el mes actual. ¡Es hora de empezar!</CardDescription>
               </CardHeader>
               <CardContent>
                   <p className="text-muted-foreground">Cuando empieces a generar leads, tu progreso aparecerá aquí.</p>
               </CardContent>
           </Card>
       )}

    </div>
  );
}


function ReportDisplay({ reportData, publisher, period }: { reportData: ReportData, publisher: Publisher, period: string }) {
    
    const processReport = () => {
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

    const processed = processReport();

    if (!processed || processed.tableRows.length === 0) return (
         <Card>
            <CardHeader>
                <CardTitle>Aún sin actividad</CardTitle>
                <CardDescription>No se han encontrado leads para el período actual: {period}</CardDescription>
            </CardHeader>
        </Card>
    );

    return (
        <Card className="mt-8 border-t pt-4">
            <CardHeader>
                <CardTitle>Hola, {publisher.firstName}</CardTitle>
                <CardDescription>{period}</CardDescription>
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
                        <TableCell className="font-bold">GANANCIA PROYECTADA</TableCell>
                        <TableCell colSpan={processed.dayColumns.length}></TableCell>
                        <TableCell className="text-center font-extrabold text-lg">{processed.totalLeads}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-extrabold text-lg">${processed.totalEarnings.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}