'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useUser } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

// Types
type Publisher = { id: string; firstName: string; lastName: string; email: string; };
type Offer = { id: string; name: string; status: 'active' | 'inactive' };

// Schema
const leadFormSchema = z.object({
  publisherId: z.string().nonempty("Debes seleccionar un publisher."),
  offerId: z.string().nonempty("Debes seleccionar una oferta."),
  day: z.string().nonempty("El día es requerido."),
  month: z.string().nonempty("El mes es requerido."),
  year: z.string().nonempty("El año es requerido."),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

export default function LeadsPage() {
  const firestore = db;
  const { user } = useUser();
  const { toast } = useToast();

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
  });

  // Data fetching
  const publishersRef = useMemo(() => (firestore && user ? collection(firestore, 'publishers') : null), [firestore, user]);
  const { data: publishers, isLoading: isLoadingPublishers } = useCollection<Publisher>(publishersRef);

  const offersRef = useMemo(() => (firestore && user ? collection(firestore, 'offers') : null), [firestore, user]);
  const { data: offers, isLoading: isLoadingOffers } = useCollection<Offer>(offersRef);

  const activeOffers = offers?.filter(o => o.status === 'active');

  const onSubmit = async (data: LeadFormData) => {
    if (!firestore) return;
    
    const { day, month, year, publisherId, offerId, quantity } = data;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const selectedPublisher = publishers?.find(p => p.id === publisherId);
    const selectedOffer = activeOffers?.find(o => o.id === offerId);

    try {
      await addDoc(collection(firestore, 'leads'), {
        publisherId,
        publisherName: `${selectedPublisher?.firstName} ${selectedPublisher?.lastName}`,
        offerId,
        offerName: selectedOffer?.name,
        date,
        quantity,
        createdAt: serverTimestamp(),
      });
      toast({
        title: "Leads cargados",
        description: `Se han registrado ${quantity} leads para ${selectedPublisher?.firstName}.`,
      });
      reset({ publisherId: '', offerId: '', day: '', month: '', year: '', quantity: 0 });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al cargar leads",
        description: error.message || "No se pudieron guardar los datos.",
      });
    }
  };

  // Date options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const selectedMonth = watch('month');
  const selectedYear = watch('year');
  const daysInMonth = (selectedMonth && selectedYear) ? new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const publisherOptions = publishers?.map(p => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} (${p.email})`,
  })) || [];

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
          <CardTitle>Registro de Leads</CardTitle>
          <CardDescription>
            Selecciona un publisher, una fecha, una oferta y la cantidad de leads a registrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label>Publisher</Label>
              <Controller
                name="publisherId"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={publisherOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Busca y selecciona un publisher..."
                    loading={isLoadingPublishers}
                  />
                )}
              />
              {errors.publisherId && <p className="text-sm text-destructive">{errors.publisherId.message}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="offerId">Oferta</Label>
              <Controller
                name="offerId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger disabled={isLoadingOffers}>
                      <SelectValue placeholder={isLoadingOffers ? "Cargando ofertas..." : "Selecciona una oferta activa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeOffers?.map(offer => (
                        <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.offerId && <p className="text-sm text-destructive">{errors.offerId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad de Leads</Label>
              <Controller
                name="quantity"
                control={control}
                render={({ field }) => <Input {...field} id="quantity" type="number" placeholder="Ej: 150" value={field.value || ''} onChange={e => field.onChange(e.target.valueAsNumber)} />}
              />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>

            <Button type="submit">Cargar Leads</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
