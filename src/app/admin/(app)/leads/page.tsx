'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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
type Publisher = { id: string; firstName: string; lastName: string; email: string; subId?: string };
type Offer = { id: string; name: string; status: 'active' | 'inactive' };
type LeadsData = Record<string, Record<string, number>>; // { publisherId: { offerId: quantity } }

// Schema for date selection
const dateSchema = z.object({
  day: z.string().nonempty('El día es requerido.'),
  month: z.string().nonempty('El mes es requerido.'),
  year: z.string().nonempty('El año es requerido.'),
});
type DateFormData = z.infer<typeof dateSchema>;

const resetSchema = z.object({
    startDate: z.date({ required_error: 'La fecha de inicio es requerida.' }),
    endDate: z.date({ required_error: 'La fecha de fin es requerida.' }),
});
type ResetFormData = z.infer<typeof resetSchema>;

export default function LeadsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [leads, setLeads] = useState<LeadsData>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [leadsToDelete, setLeadsToDelete] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPublishers, setSelectedPublishers] = useState<Publisher[]>([]);

  // Date options dynamic
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const start = 2023;
    const end = current + 1;
    return Array.from({ length: Math.max(end - start + 1, 5) }, (_, i) => start + i).reverse();
  }, []);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  // Form for lead entry
  const {
    control: entryControl,
    handleSubmit: handleEntrySubmit,
    watch: watchEntry,
    formState: { errors: entryErrors },
  } = useForm<DateFormData>({
    resolver: zodResolver(dateSchema),
    defaultValues: {
      day: String(new Date().getDate()),
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
    },
  });

  // Form for lead reset
  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    watch: watchReset,
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const selectedMonth = watchEntry('month');
  const selectedYear = watchEntry('year');
  const daysInMonth = useMemo(() => (selectedMonth && selectedYear) ? new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10), 0).getDate() : 31, [selectedMonth, selectedYear]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Data fetching
  const publishersRef = useMemo(
    () => (firestore && user ? collection(firestore, 'publishers') : null),
    [firestore, user]
  );
  const { data: allPublishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);

  const offersRef = useMemo(
    () => (firestore && user ? query(collection(firestore, 'offers'), where('status', '==', 'active')) : null),
    [firestore, user]
  );
  const { data: activeOffers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);

  const publisherOptions = useMemo(() => {
    return allPublishers
      ? allPublishers
          .filter(p => !selectedPublishers.some(sp => sp.id === p.id))
          .map(p => ({
              value: p.id,
              label: `${p.firstName} ${p.lastName} ${p.subId ? `(Sub ID: ${p.subId})` : ''}`,
            }))
      : [];
  }, [allPublishers, selectedPublishers]);

  const handlePublisherSelect = (publisherId: string) => {
    const publisherToAdd = allPublishers?.find(p => p.id === publisherId);
    if (publisherToAdd) {
      setSelectedPublishers(prev => [...prev, publisherToAdd]);
    }
  };

  const handleRemovePublisher = (publisherId: string) => {
    setSelectedPublishers(prev => prev.filter(p => p.id !== publisherId));
    setLeads(prevLeads => {
        const newLeads = {...prevLeads};
        delete newLeads[publisherId];
        return newLeads;
    })
  };

  const handleLeadChange = (publisherId: string, offerId: string, quantity: string) => {
    const numQuantity = parseInt(quantity, 10);
    setLeads(prevLeads => ({
      ...prevLeads,
      [publisherId]: {
        ...prevLeads[publisherId],
        [offerId]: isNaN(numQuantity) ? 0 : numQuantity,
      },
    }));
  };

  const saveLeads = async (data: DateFormData) => {
    if (!firestore) return;
    setIsSaving(true);

    const { day, month, year } = data;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    let leadsSavedCount = 0;

    for (const publisherId in leads) {
      const publisherOffers = leads[publisherId];
      const selectedPublisher = allPublishers?.find(p => p.id === publisherId);

      for (const offerId in publisherOffers) {
        const quantity = publisherOffers[offerId];
        if (quantity > 0) {
          const selectedOffer = activeOffers?.find(o => o.id === offerId);

          const leadsQuery = query(
            collection(firestore, 'leads'),
            where('publisherId', '==', publisherId),
            where('offerId', '==', offerId),
            where('date', '==', date)
          );

          const existingLeads = await getDocs(leadsQuery);

          if (existingLeads.empty) {
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
            const leadDocRef = doc(firestore, 'leads', existingLeads.docs[0].id);
            await setDoc(leadDocRef, { quantity }, { merge: true });
          }
          leadsSavedCount++;
        }
      }
      if (Object.values(publisherOffers).some(qty => qty > 0)) {
        toast({
          title: 'Leads guardados',
          description: `Se han registrado los leads para ${selectedPublisher?.firstName} ${selectedPublisher?.lastName}.`,
        });
      }
    }

    if (leadsSavedCount === 0) {
      toast({
        variant: 'destructive',
        title: 'No hay leads para guardar',
        description: 'Por favor, introduce una cantidad mayor que cero.',
      });
    }
    
    setLeads({});
    setIsSaving(false);
  };
  
  const prepareToDeleteLeads = async (data: ResetFormData) => {
    if (!firestore) return;

    const { startDate, endDate } = data;
    if (endDate < startDate) {
        toast({ variant: 'destructive', title: 'Error de Fechas', description: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
        return;
    }

    setIsResetting(true);
    const startDateString = format(startDate, 'yyyy-MM-dd');
    const endDateString = format(endDate, 'yyyy-MM-dd');

    const leadsQuery = query(
        collection(firestore, 'leads'),
        where('date', '>=', startDateString),
        where('date', '<=', endDateString)
    );

    const snapshot = await getDocs(leadsQuery);
    setLeadsToDelete(snapshot.docs);
    setIsResetting(false);
    
    if (snapshot.empty) {
        toast({ title: 'Sin registros', description: 'No se encontraron leads para eliminar en el período seleccionado.' });
    } else {
        setIsDeleteDialogOpen(true);
    }
  };

  const executeDeleteLeads = async () => {
    if (!firestore || leadsToDelete.length === 0) return;
    setIsResetting(true);

    const batch = writeBatch(firestore);
    leadsToDelete.forEach(leadDoc => {
        batch.delete(leadDoc.ref);
    });

    try {
        await batch.commit();
        toast({ title: 'Reseteo Exitoso', description: `Se eliminaron ${leadsToDelete.length} registros de leads.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error al Resetear', description: error.message });
    } finally {
        setIsResetting(false);
        setLeadsToDelete([]);
        setIsDeleteDialogOpen(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline text-foreground">Cargar Leads</h1>
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
            Selecciona una fecha, busca y añade los publishers a los que les cargarás leads, y luego introduce las cantidades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEntrySubmit(saveLeads)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="space-y-2">
                <Label htmlFor="day">Día</Label>
                <Controller
                  name="day"
                  control={entryControl}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Día" /></SelectTrigger>
                      <SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
                {entryErrors.day && <p className="text-sm text-destructive">{entryErrors.day.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="month">Mes</Label>
                <Controller
                  name="month"
                  control={entryControl}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                      <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
                {entryErrors.month && <p className="text-sm text-destructive">{entryErrors.month.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Año</Label>
                <Controller
                  name="year"
                  control={entryControl}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
                {entryErrors.year && <p className="text-sm text-destructive">{entryErrors.year.message}</p>}
              </div>
            </div>

            <div className="space-y-2 mb-8">
                <Label>Buscar y Añadir Publisher</Label>
                 <Combobox
                    options={publisherOptions}
                    onChange={handlePublisherSelect}
                    value=""
                    placeholder="Buscar por nombre, apellido, email o Sub ID..."
                    loading={isLoadingPublishers}
                />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background font-bold min-w-[250px]">Publisher</TableHead>
                    {isLoadingOffers ? (
                      <TableHead>Cargando...</TableHead>
                    ) : (
                      activeOffers?.map(offer => (
                        <TableHead key={offer.id} className="text-center min-w-[150px]">
                          <div className="whitespace-nowrap">{offer.name}</div>
                        </TableHead>
                      ))
                    )}
                    <TableHead className="text-right min-w-[50px]">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPublishers.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={ (activeOffers?.length || 0) + 2 } className="text-center text-muted-foreground h-24">
                           Añade publishers usando la barra de búsqueda para empezar a cargar leads.
                        </TableCell>
                    </TableRow>
                  ) : (
                    selectedPublishers.map(publisher => (
                      <TableRow key={publisher.id}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {`${publisher.firstName} ${publisher.lastName}`}
                          {publisher.subId && <span className="text-muted-foreground ml-2">({publisher.subId})</span>}
                        </TableCell>
                        {activeOffers?.map(offer => (
                          <TableCell key={offer.id}>
                            <Input
                              type="number"
                              min="0"
                              className="text-center"
                              placeholder="0"
                              value={leads[publisher.id]?.[offer.id] || ''}
                              onChange={e => handleLeadChange(publisher.id, offer.id, e.target.value)}
                            />
                          </TableCell>
                        ))}
                         <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => handleRemovePublisher(publisher.id)}>
                             <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                         </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Button type="submit" disabled={isSaving || selectedPublishers.length === 0}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Guardando...' : 'Guardar Leads'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive">
         <CardHeader>
             <CardTitle>Zona de Peligro: Resetear Leads</CardTitle>
             <CardDescription>
                Esta acción eliminará permanentemente todos los registros de leads dentro del rango de fechas seleccionado. Úsala con precaución.
             </CardDescription>
         </CardHeader>
         <CardContent>
            <form onSubmit={handleResetSubmit(prepareToDeleteLeads)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>Desde</Label>
                        <Controller
                            name="startDate"
                            control={resetControl}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>Hasta</Label>
                        <Controller
                            name="endDate"
                            control={resetControl}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                    </div>
                    <Button type="submit" variant="destructive" disabled={isResetting || !watchReset('startDate') || !watchReset('endDate')}>
                        {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Validar Período
                    </Button>
                </div>
            </form>
         </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta acción es irreversible. Se eliminarán <span className="font-bold text-destructive">{leadsToDelete.length}</span> registros de leads del período seleccionado.
                      ¿Deseas continuar?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => { setLeadsToDelete([]); setIsDeleteDialogOpen(false); }}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={executeDeleteLeads} disabled={isResetting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sí, eliminar leads permanentemente
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
