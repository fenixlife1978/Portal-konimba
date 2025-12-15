'use client';
import { useEffect, useState } from 'react';
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

const phoneCodes = ["0412", "0414", "0416", "0424", "0426"];
const idPrefixes = ["V", "E", "J", "G", "P"];

const paymentSchema = z.object({
  country: z.enum(['VE', 'CO'], { required_error: "Debes seleccionar un país." }),
  paymentMethod: z.enum(['transferencia', 'pagoMovil', 'usdt'], { required_error: "Debes seleccionar un método de pago." }),
  // Transferencia fields
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  // Pago Movil fields
  mobilePaymentBank: z.string().optional(),
  mobilePaymentPhoneCode: z.string().optional(),
  mobilePaymentPhoneNumber: z.string().optional(),
  mobilePaymentIdPrefix: z.string().optional(),
  mobilePaymentIdNumber: z.string().optional(),
  // USDT fields
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'transferencia') {
    if (!data.bank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['bank'] });
    if (!data.accountNumber || data.accountNumber.length < 20) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cuenta debe tener 20 dígitos.", path: ['accountNumber'] });
  }
  if (data.paymentMethod === 'pagoMovil') {
    if (data.country !== 'VE') ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pago Móvil solo para Venezuela.", path: ['country'] });
    if (!data.mobilePaymentBank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['mobilePaymentBank'] });
    if (!data.mobilePaymentPhoneCode) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona un código.", path: ['mobilePaymentPhoneCode'] });
    if (!data.mobilePaymentPhoneNumber || data.mobilePaymentPhoneNumber.length < 7) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El número debe tener 7 dígitos.", path: ['mobilePaymentPhoneNumber'] });
    if (!data.mobilePaymentIdPrefix) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona un prefijo.", path: ['mobilePaymentIdPrefix'] });
    if (!data.mobilePaymentIdNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El número es requerido.", path: ['mobilePaymentIdNumber'] });
  }
  if (data.paymentMethod === 'usdt') {
    if (!data.usdtPlatform) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La plataforma es requerida.", path: ['usdtPlatform'] });
    if (!data.usdtAddress) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La dirección o ID es requerida.", path: ['usdtAddress'] });
  }
});

type PublisherFormData = z.infer<typeof paymentSchema>;

type PublisherDbData = {
  country?: 'VE' | 'CO';
  paymentMethod?: 'transferencia' | 'pagoMovil' | 'usdt';
  bank?: string;
  accountNumber?: string;
  mobilePaymentBank?: string;
  mobilePaymentPhone?: string;
  mobilePaymentId?: string;
  usdtPlatform?: string;
  usdtAddress?: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const publisherRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'publishers', user.uid);
  }, [firestore, user]);

  const { data: publisherData, isLoading: isLoadingData } = useDoc<PublisherDbData>(publisherRef);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<PublisherFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      country: undefined,
      paymentMethod: undefined,
      bank: '',
      accountNumber: '',
      mobilePaymentBank: '',
      mobilePaymentPhoneCode: '',
      mobilePaymentPhoneNumber: '',
      mobilePaymentIdPrefix: '',
      mobilePaymentIdNumber: '',
      usdtPlatform: '',
      usdtAddress: '',
    },
  });

  useEffect(() => {
    if (publisherData) {
      // Logic to transform flat DB data to structured form data
      const formData: PublisherFormData = {
          country: publisherData.country,
          paymentMethod: publisherData.paymentMethod,
          bank: publisherData.bank,
          accountNumber: publisherData.accountNumber,
          mobilePaymentBank: publisherData.mobilePaymentBank,
          usdtPlatform: publisherData.usdtPlatform,
          usdtAddress: publisherData.usdtAddress,
      };

      if (publisherData.mobilePaymentPhone) {
          formData.mobilePaymentPhoneCode = publisherData.mobilePaymentPhone.substring(0, 4);
          formData.mobilePaymentPhoneNumber = publisherData.mobilePaymentPhone.substring(4);
      }
       if (publisherData.mobilePaymentId) {
          const parts = publisherData.mobilePaymentId.split('-');
          if (parts.length > 1) {
            formData.mobilePaymentIdPrefix = parts[0];
            formData.mobilePaymentIdNumber = parts.slice(1).join('-');
          } else {
            formData.mobilePaymentIdPrefix = isNaN(parseInt(parts[0][0])) ? parts[0][0] : undefined;
            formData.mobilePaymentIdNumber = isNaN(parseInt(parts[0][0])) ? parts[0].substring(1) : parts[0];
          }
      }
      reset(formData);
    }
  }, [publisherData, reset]);

  const country = watch('country');
  const paymentMethod = watch('paymentMethod');
  
  const handleCountryChange = (value: 'VE' | 'CO') => {
      setValue('country', value);
      setValue('paymentMethod', undefined);
      trigger('country');
  }
  
  const handlePaymentMethodChange = (value: 'transferencia' | 'pagoMovil' | 'usdt') => {
      setValue('paymentMethod', value);
      // Clear fields of other methods
      const fieldsToKeep: (keyof PublisherFormData)[] = ['country', 'paymentMethod'];
      if(value === 'transferencia') {
        fieldsToKeep.push('bank', 'accountNumber');
      } else if (value === 'pagoMovil') {
        fieldsToKeep.push('mobilePaymentBank', 'mobilePaymentPhoneCode', 'mobilePaymentPhoneNumber', 'mobilePaymentIdPrefix', 'mobilePaymentIdNumber');
      } else if (value === 'usdt') {
        fieldsToKeep.push('usdtPlatform', 'usdtAddress');
      }

      const currentValues = watch();
      const newValues = { ...currentValues };
      (Object.keys(newValues) as (keyof PublisherFormData)[]).forEach(key => {
        if (!fieldsToKeep.includes(key)) {
            (newValues as any)[key] = undefined;
        }
      });
      reset(newValues);
      trigger('paymentMethod');
  }

  const onSubmit = async (data: PublisherFormData) => {
    if (!publisherRef) return;
    
    const dataToSave: PublisherDbData = {
        country: data.country,
        paymentMethod: data.paymentMethod,
    };

    if (data.paymentMethod === 'transferencia') {
        dataToSave.bank = data.bank;
        dataToSave.accountNumber = data.accountNumber;
    } else if (data.paymentMethod === 'pagoMovil') {
        dataToSave.mobilePaymentBank = data.mobilePaymentBank;
        dataToSave.mobilePaymentPhone = `${data.mobilePaymentPhoneCode}${data.mobilePaymentPhoneNumber}`;
        dataToSave.mobilePaymentId = `${data.mobilePaymentIdPrefix}-${data.mobilePaymentIdNumber}`;
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
                <Controller
                    name="country"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={handleCountryChange} value={field.value || ''}>
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
                         <Select onValueChange={handlePaymentMethodChange} value={field.value || ''} disabled={!country}>
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
                            <Select onValueChange={field.onChange} value={field.value || ''}>
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
                    <Label htmlFor="accountNumber">Número de Cuenta (20 dígitos) *</Label>
                    <Input {...register('accountNumber')} id="accountNumber" placeholder="0102..." maxLength={20} />
                    {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'pagoMovil' && country === 'VE' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Pago Móvil (Solo Venezuela)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="mobilePaymentBank">Banco *</Label>
                     <Controller
                        name="mobilePaymentBank"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
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
                      <Label htmlFor="mobilePaymentPhoneNumber">Número de Teléfono *</Label>
                      <div className="flex gap-2">
                        <Controller
                            name="mobilePaymentPhoneCode"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger className="w-[120px]"><SelectValue placeholder="Código"/></SelectTrigger>
                                    <SelectContent>
                                        {phoneCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <Input {...register('mobilePaymentPhoneNumber')} id="mobilePaymentPhoneNumber" placeholder="XXXXXXX" maxLength={7} />
                      </div>
                      {errors.mobilePaymentPhoneCode && <p className="text-sm text-destructive">{errors.mobilePaymentPhoneCode.message}</p>}
                      {errors.mobilePaymentPhoneNumber && <p className="text-sm text-destructive">{errors.mobilePaymentPhoneNumber.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label htmlFor="mobilePaymentIdNumber">Cédula o RIF *</Label>
                    <div className="flex gap-2">
                         <Controller
                            name="mobilePaymentIdPrefix"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tipo"/></SelectTrigger>
                                    <SelectContent>
                                        {idPrefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <Input {...register('mobilePaymentIdNumber')} id="mobilePaymentIdNumber" placeholder="12345678" />
                    </div>
                     {errors.mobilePaymentIdPrefix && <p className="text-sm text-destructive">{errors.mobilePaymentIdPrefix.message}</p>}
                     {errors.mobilePaymentIdNumber && <p className="text-sm text-destructive">{errors.mobilePaymentIdNumber.message}</p>}
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
