'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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

// Base schema for all fields, all optional initially.
const baseSchema = z.object({
  country: z.enum(['', 'VE', 'CO']).optional(),
  paymentMethod: z.enum(['', 'transferencia', 'pagoMovil', 'usdt']).optional(),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  mobilePaymentBank: z.string().optional(),
  mobilePaymentPhone: z.string().optional(),
  mobilePaymentId: z.string().optional(),
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
});

// Refined schema for conditional validation.
const refinedSchema = baseSchema.superRefine((data, ctx) => {
    if (data.paymentMethod === 'transferencia') {
        if (!data.country) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El país es requerido.", path: ['country'] });
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


type FormData = z.infer<typeof baseSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const publisherRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'publishers', user.uid);
  }, [firestore, user]);

  const { data: publisherData, isLoading: isLoadingData } = useDoc<FormData>(publisherRef);

  const { control, handleSubmit, reset, watch, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
      country: '',
      paymentMethod: '',
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

  const onSubmit = async (data: FormData) => {
    if (!publisherRef) return;
    setIsSaving(true);
    try {
      
      const finalData: Partial<FormData> = {
        updatedAt: serverTimestamp() as any,
        country: data.country,
        paymentMethod: data.paymentMethod
      };

      if (data.paymentMethod === 'transferencia') {
        finalData.bank = data.bank;
        finalData.accountNumber = data.accountNumber;
      } else if (data.paymentMethod === 'pagoMovil') {
        finalData.mobilePaymentBank = data.mobilePaymentBank;
        finalData.mobilePaymentPhone = data.mobilePaymentPhone;
        finalData.mobilePaymentId = data.mobilePaymentId;
      } else if (data.paymentMethod === 'usdt') {
        finalData.usdtPlatform = data.usdtPlatform;
        finalData.usdtAddress = data.usdtAddress;
      }
      
      await setDoc(publisherRef, finalData , { merge: true });

      toast({
        title: "Configuración guardada",
        description: "Tus datos de pago se han actualizado correctamente.",
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los cambios.",
      });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (isLoadingData) {
    return <div className="flex items-center justify-center pt-16"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Cargando configuración...</span></div>;
  }

  const country = watch('country');
  const paymentMethod = watch('paymentMethod');

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
                {/* --- SELECCIÓN PRINCIPAL --- */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                        <Label htmlFor="country">País de Residencia *</Label>
                        <Controller
                            name="country"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={(value) => { field.onChange(value); setValue('paymentMethod', ''); }} value={field.value}>
                                <SelectTrigger id="country"><SelectValue placeholder="Selecciona tu país" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="VE">Venezuela</SelectItem>
                                    <SelectItem value="CO">Colombia</SelectItem>
                                </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Método de Pago Principal *</Label>
                        <Controller
                            name="paymentMethod"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value} disabled={!country}>
                                <SelectTrigger id="paymentMethod"><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                                <SelectContent>
                                    {country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                                    {(country === 'VE' || country === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                                    <SelectItem value="usdt">USDT</SelectItem>
                                </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                    </div>
                 </div>

                {paymentMethod && <Separator />}
                
                {/* --- SECCIÓN TRANSFERENCIA BANCARIA --- */}
                {paymentMethod === 'transferencia' && (
                    <div className='space-y-4 animate-in fade-in-0 duration-300'>
                        <h3 className="font-semibold text-lg text-foreground">Detalles de Transferencia Bancaria</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="bank">Banco *</Label>
                                <Controller
                                    name="bank"
                                    control={control}
                                    render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!country}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                                        <SelectContent>
                                            {country === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                            {country === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    )}
                                />
                                {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountNumber">Número de Cuenta *</Label>
                                <Controller
                                    name="accountNumber"
                                    control={control}
                                    render={({ field }) => <Input {...field} id="accountNumber" placeholder="0102..." />}
                                />
                                {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                            </div>
                        </div>
                    </div>
                )}


                {/* --- SECCIÓN PAGO MÓVIL --- */}
                {paymentMethod === 'pagoMovil' && (
                    <div className='space-y-4 animate-in fade-in-0 duration-300'>
                        <h3 className="font-semibold text-lg text-foreground">Detalles de Pago Móvil (Solo Venezuela)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="mobilePaymentBank">Banco *</Label>
                                <Controller
                                    name="mobilePaymentBank"
                                    control={control}
                                    render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={country !== 'VE'}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                                        <SelectContent>
                                            {banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    )}
                                />
                                {errors.mobilePaymentBank && <p className="text-sm text-destructive">{errors.mobilePaymentBank.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobilePaymentPhone">Número de Teléfono *</Label>
                                <Controller
                                    name="mobilePaymentPhone"
                                    control={control}
                                    render={({ field }) => <Input {...field} id="mobilePaymentPhone" placeholder="04XX-XXXXXXX" />}
                                />
                                {errors.mobilePaymentPhone && <p className="text-sm text-destructive">{errors.mobilePaymentPhone.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobilePaymentId">Cédula o RIF *</Label>
                                 <Controller
                                    name="mobilePaymentId"
                                    control={control}
                                    render={({ field }) => <Input {...field} id="mobilePaymentId" placeholder="V-12345678" />}
                                />
                                {errors.mobilePaymentId && <p className="text-sm text-destructive">{errors.mobilePaymentId.message}</p>}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* --- SECCIÓN USDT --- */}
                {paymentMethod === 'usdt' && (
                    <div className='space-y-4 animate-in fade-in-0 duration-300'>
                        <h3 className="font-semibold text-lg text-foreground">Detalles de USDT</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="usdtPlatform">Plataforma *</Label>
                                <Controller
                                    name="usdtPlatform"
                                    control={control}
                                    render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona una plataforma" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="binance">Binance</SelectItem>
                                            <SelectItem value="otro">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    )}
                                />
                                {errors.usdtPlatform && <p className="text-sm text-destructive">{errors.usdtPlatform.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="usdtAddress">Dirección USDT (o ID de Pago) *</Label>
                                <Controller
                                    name="usdtAddress"
                                    control={control}
                                    render={({ field }) => <Input {...field} id="usdtAddress" placeholder="Tu dirección o ID de pago" />}
                                />
                                {errors.usdtAddress && <p className="text-sm text-destructive">{errors.usdtAddress.message}</p>}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
            
            <div className="p-6 pt-0">
              <Button type="submit" disabled={isSaving}>
                  {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>) : 'Guardar Cambios'}
              </Button>
            </div>
        </Card>
      </form>
    </div>
  );
}
