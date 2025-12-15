'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

import banksVe from '@/lib/banks-ve.json';
import banksCo from '@/lib/banks-co.json';

const paymentSchema = z.object({
  country: z.enum(['VE', 'CO'], { required_error: "Debes seleccionar un país." }),
  paymentMethod: z.enum(['transferencia', 'pagoMovil', 'usdt'], { required_error: "Debes seleccionar un método de pago." }),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  mobilePaymentBank: z.string().optional(),
  mobilePaymentPhone: z.string().optional(),
  mobilePaymentId: z.string().optional(),
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'transferencia') {
    if (!data.bank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['bank'] });
    if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El número de cuenta es requerido.", path: ['accountNumber'] });
  }
  if (data.paymentMethod === 'pagoMovil') {
    if (data.country !== 'VE') ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pago Móvil solo para Venezuela.", path: ['country'] });
    if (!data.mobilePaymentBank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['mobilePaymentBank'] });
    if (!data.mobilePaymentPhone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El teléfono es requerido.", path: ['mobilePaymentPhone'] });
    if (!data.mobilePaymentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cédula/RIF es requerida.", path: ['mobilePaymentId'] });
  }
  if (data.paymentMethod === 'usdt') {
    if (!data.usdtPlatform) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La plataforma es requerida.", path: ['usdtPlatform'] });
    if (!data.usdtAddress) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La dirección o ID es requerida.", path: ['usdtAddress'] });
  }
});

type PublisherData = z.infer<typeof paymentSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const publisherRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'publishers', user.uid);
  }, [firestore, user]);

  const { data: publisherData, isLoading: isLoadingData } = useDoc<PublisherData>(publisherRef);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    trigger,
  } = useForm<PublisherData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      country: undefined,
      paymentMethod: undefined,
      bank: '',
      accountNumber: '',
      mobilePaymentBank: '',
      mobilePaymentPhone: '',
      mobilePaymentId: '',
      usdtPlatform: '',
      usdtAddress: '',
    },
  });

  useEffect(() => {
    if (publisherData) {
      reset(publisherData);
    }
  }, [publisherData, reset]);

  const country = watch('country');
  const paymentMethod = watch('paymentMethod');
  
  const handleCountryChange = (value: 'VE' | 'CO') => {
      setValue('country', value);
      setValue('paymentMethod', undefined); // Reset payment method
      // Clear all specific payment fields
      setValue('bank', '');
      setValue('accountNumber', '');
      setValue('mobilePaymentBank', '');
      setValue('mobilePaymentPhone', '');
      setValue('mobilePaymentId', '');
      trigger('country'); // Re-validate
  }
  
  const handlePaymentMethodChange = (value: 'transferencia' | 'pagoMovil' | 'usdt') => {
      setValue('paymentMethod', value);
      trigger('paymentMethod');
  }

  const onSubmit = async (data: PublisherData) => {
    if (!publisherRef) return;
    
    // Sanitize data before saving
    const dataToSave: Partial<PublisherData> = {
        country: data.country,
        paymentMethod: data.paymentMethod,
    };

    if (data.paymentMethod === 'transferencia') {
        dataToSave.bank = data.bank;
        dataToSave.accountNumber = data.accountNumber;
    } else if (data.paymentMethod === 'pagoMovil') {
        dataToSave.mobilePaymentBank = data.mobilePaymentBank;
        dataToSave.mobilePaymentPhone = data.mobilePaymentPhone;
        dataToSave.mobilePaymentId = data.mobilePaymentId;
    } else if (data.paymentMethod === 'usdt') {
        dataToSave.usdtPlatform = data.usdtPlatform;
        dataToSave.usdtAddress = data.usdtAddress;
    }

    try {
      await setDoc(publisherRef, {
        ...dataToSave,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({
        title: "Configuración guardada",
        description: "Tus datos de pago se han actualizado correctamente.",
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los cambios. Revisa los permisos de Firestore.",
      });
    }
  };

  if (isLoadingData) {
    return <div className="flex items-center justify-center pt-16"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Cargando configuración...</span></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Configuración de Pagos</h1>
        <Button asChild variant="outline">
          <Link href="/publisher"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Método de Pago</CardTitle>
            <CardDescription>
              Selecciona tu país y método de pago, y luego completa los campos requeridos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="country">País de Residencia *</Label>
                <Select onValueChange={handleCountryChange} value={country || ''}>
                  <SelectTrigger id="country"><SelectValue placeholder="Selecciona tu país" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VE">Venezuela</SelectItem>
                    <SelectItem value="CO">Colombia</SelectItem>
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago Principal *</Label>
                <Select onValueChange={handlePaymentMethodChange} value={paymentMethod || ''} disabled={!country}>
                  <SelectTrigger id="paymentMethod"><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                  <SelectContent>
                    {country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                    {(country === 'VE' || country === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                    <SelectItem value="usdt">USDT</SelectItem>
                  </SelectContent>
                </Select>
                {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
              </div>
            </div>

            {paymentMethod && <Separator />}

            {paymentMethod === 'transferencia' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Transferencia Bancaria</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank">Banco *</Label>
                    <Select onValueChange={(value) => setValue('bank', value)} value={watch('bank') || ''} disabled={!country}>
                      <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                      <SelectContent>
                        {country === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        {country === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Número de Cuenta *</Label>
                    <Input {...register('accountNumber')} id="accountNumber" placeholder="0102..." />
                    {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'pagoMovil' && country === 'VE' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Pago Móvil (Solo Venezuela)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mobilePaymentBank">Banco *</Label>
                    <Select onValueChange={(value) => setValue('mobilePaymentBank', value)} value={watch('mobilePaymentBank') || ''}>
                      <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                      <SelectContent>
                        {banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.mobilePaymentBank && <p className="text-sm text-destructive">{errors.mobilePaymentBank.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobilePaymentPhone">Número de Teléfono *</Label>
                    <Input {...register('mobilePaymentPhone')} id="mobilePaymentPhone" placeholder="04XX-XXXXXXX" />
                    {errors.mobilePaymentPhone && <p className="text-sm text-destructive">{errors.mobilePaymentPhone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobilePaymentId">Cédula o RIF *</Label>
                    <Input {...register('mobilePaymentId')} id="mobilePaymentId" placeholder="V-12345678" />
                    {errors.mobilePaymentId && <p className="text-sm text-destructive">{errors.mobilePaymentId.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'usdt' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de USDT</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="usdtPlatform">Plataforma *</Label>
                    <Select onValueChange={(value) => setValue('usdtPlatform', value)} value={watch('usdtPlatform') || ''}>
                      <SelectTrigger><SelectValue placeholder="Selecciona una plataforma" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="binance">Binance</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.usdtPlatform && <p className="text-sm text-destructive">{errors.usdtPlatform.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usdtAddress">Dirección USDT (o ID de Pago) *</Label>
                    <Input {...register('usdtAddress')} id="usdtAddress" placeholder="Tu dirección o ID de pago" />
                    {errors.usdtAddress && <p className="text-sm text-destructive">{errors.usdtAddress.message}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <div className="p-6 pt-0">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>) : 'Guardar Cambios'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
