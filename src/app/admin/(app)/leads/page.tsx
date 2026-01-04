'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Types
type Publisher = { id: string; firstName: string; lastName: string; email: string; };
type Offer = { id:string; name: string; status: 'active' | 'inactive' };
type LeadsData = Record<string, Record<string, number>>; // { publisherId: { offerId: quantity } }


// Schema for date selection
const dateSchema = z.object({
  day: z.string().nonempty("El día es requerido."),
  month: z.string().nonempty("El mes es requerido."),
  year: z.string().nonempty("El año es requerido."),
});
type DateFormData = z.infer<typeof dateSchema>;


export default function LeadsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const { control, handleSubmit: handleDateSubmit, watch, formState: { errors } } = useForm<DateFormData>({
    resolver: zodResolver(dateSchema),
    defaultValues: {
      day: String(new Date().getDate()),
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    }
  });

  // State for the leads matrix
  const [leads, setLeads] = useState<LeadsData>({});
  const [isSaving, setIsSaving] = useState(false);

  // Data fetching
  const publishersRef = useMemo(() => (firestore && user ? collection(firestore, 'publishers') : null), [firestore, user]);
  const { data: publishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);

  const offersRef = useMemo(() => (firestore && user ? query(collection(firestore, 'offers'), where('status', '==', 'active')) : null), [firestore, user]);
  const { data: activeOffers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);

  const handleLeadChange = (publisherId: string, offerId: string, quantity: string) => {
    const numQuantity = parseInt(quantity, 10);
    setLeads(prevLeads => ({
      ...prevLeads,
      [publisherId]: {
        ...prevLeads[publisherId],
        [offerId]: isNaN(numQuantity) ? 0 : numQuantity
      }
    }));
  };

  const saveLeads = async (data: DateFormData) => {
    if (!firestore) return;
    setIsSaving(true);
    
    const { day, month, year } = data;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    let leadsSavedCount = 0;
    
    for (const publisherId in leads) {
        const publisherOffers = leads[publisherId];
        const selectedPublisher = publishers?.find(p => p.id === publisherId);

        for (const offerId in publisherOffers) {
            const quantity = publisherOffers[offerId];
            if (quantity > 0) {
                const selectedOffer = activeOffers?.find(o => o.id === offerId);
                
                // Check if a lead for this publisher, offer, and date already exists.
                const leadsQuery = query(collection(firestore, 'leads'), 
                    where('publisherId', '==', publisherId), 
                    where('offerId', '==', offerId), 
                    where('date', '==', date)
                );

                const existingLeads = await getDocs(leadsQuery);

                if (existingLeads.empty) {
                    // Create new lead document
                    const newLeadRef = collection(firestore, 'leads');
                     addDocumentNonBlocking(newLeadRef, {
                        publisherId,
                        publisherName: `${selectedPublisher?.firstName} ${selectedPublisher?.lastName}`,
                        offerId,
                        offerName: selectedOffer?.name,
                        date,
                        quantity,
                    });
                } else {
                    // Update existing lead document
                    const leadDocRef = doc(firestore, 'leads', existingLeads.docs[0].id);
                    await setDoc(leadDocRef, { quantity }, { merge: true });
                }
                leadsSavedCount++;
            }
        }
        if (Object.values(publisherOffers).some(qty => qty > 0)) {
            toast({
                title: "Leads guardados",
                description: `Se han registrado los leads para ${selectedPublisher?.firstName} ${selectedPublisher?.lastName}.`,
            });
        }
    }
    
    if (leadsSavedCount === 0) {
        toast({
            variant: "destructive",
            title: "No hay leads para guardar",
            description: "Por favor, introduce una cantidad mayor que cero.",
        });
    }

    setLeads({}); // Clear the form after saving
    setIsSaving(false);
  };

  // Date options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const selectedMonth = watch('month');
  const selectedYear = watch('year');
  const daysInMonth = (selectedMonth && selectedYear) ? new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const sortedPublishers = useMemo(() => {
    return publishers ? [...publishers].sort((a, b) => a.firstName.localeCompare(b.firstName)) : [];
  }, [publishers]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Cargar Leads
        </h1>
        <Button asChild variant="outline">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Leads por Día</CardTitle>
          <CardDescription>
            Selecciona una fecha e introduce la cantidad de leads para cada publisher y oferta.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {/* Date Selection Form */}
            <form onSubmit={handleDateSubmit(saveLeads)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="space-y-2">
                        <Label htmlFor="day">Día</Label>
                        <Controller name="day" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Día" /></SelectTrigger>
                            <SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                        )} />
                        {errors.day && <p className="text-sm text-destructive">{errors.day.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="month">Mes</Label>
                        <Controller name="month" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
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

                {/* Leads Matrix Table */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="sticky left-0 bg-background font-bold min-w-[200px]">Publisher</TableHead>
                            {(isLoadingOffers || isLoadingPublishers) ? (
                                <TableHead>Cargando...</TableHead>
                            ) : (
                                activeOffers?.map(offer => (
                                <TableHead key={offer.id} className="text-center min-w-[150px]">
                                    <div className="whitespace-nowrap">{offer.name}</div>
                                </TableHead>
                                ))
                            )}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {(isLoadingOffers || isLoadingPublishers) ? (
                            <TableRow>
                                <TableCell colSpan={ (activeOffers?.length || 0) + 1 } className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedPublishers.map(publisher => (
                            <TableRow key={publisher.id}>
                                <TableCell className="sticky left-0 bg-background font-medium">
                                {`${publisher.firstName} ${publisher.lastName}`}
                                </TableCell>
                                {activeOffers?.map(offer => (
                                <TableCell key={offer.id}>
                                    <Input
                                    type="number"
                                    min="0"
                                    className="text-center"
                                    placeholder="0"
                                    value={leads[publisher.id]?.[offer.id] || ''}
                                    onChange={(e) => handleLeadChange(publisher.id, offer.id, e.target.value)}
                                    />
                                </TableCell>
                                ))}
                            </TableRow>
                            ))
                        )}
                        </TableBody>
                    </Table>
                </div>
                
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving ? 'Guardando...' : 'Guardar Leads'}
                </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
