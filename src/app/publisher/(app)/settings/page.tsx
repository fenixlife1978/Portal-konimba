'use client';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

import banksVe from '@/lib/banks-ve.json';
import banksCo from '@/lib/banks-co.json';

const phoneCodes = ["0412", "0414", "0416", "0424", "0426"];
const idPrefixes = ["V", "E", "J", "G", "P"];

// Base schema for all methods
const baseSchema = z.object({
  country: z.enum(['VE', 'CO', '']),
  paymentMethod: z.enum(['transferencia', 'pagoMovil', 'usdt', '']),
});

// Conditional validation schema
const formSchema = baseSchema.superRefine((data, ctx) => {
  if (data.paymentMethod === 'transferencia') {
    if (!data.bank) ctx.addIssue({ code: 'custom', path: ['bank'], message: 'El banco es requerido.' });
    if (!data.accountNumber) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'El número de cuenta es requerido.' });
    else if (!/^\d{20}$/.test(data.accountNumber)) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'La cuenta debe tener 20 dígitos.' });
  } else if (data.paymentMethod === 'pagoMovil' && data.country === 'VE') {
    if (!data.mobilePaymentBank) ctx.addIssue({ code: 'custom', path: ['mobilePaymentBank'], message: 'El banco es requerido.' });
    if (!data.mobilePaymentPhoneCode) ctx.addIssue({ code: 'custom', path: ['mobilePaymentPhoneCode'], message: 'El código es requerido.' });
    if (!data.mobilePaymentPhoneNumber) ctx.addIssue({ code: 'custom', path: ['mobilePaymentPhoneNumber'], message: 'El número es requerido.' });
    else if (!/^\d{7}$/.test(data.mobilePaymentPhoneNumber)) ctx.addIssue({ code: 'custom', path: ['mobilePaymentPhoneNumber'], message: 'El número debe tener 7 dígitos.' });
    if (!data.mobilePaymentIdPrefix) ctx.addIssue({ code: 'custom', path: ['mobilePaymentIdPrefix'], message: 'El prefijo es requerido.' });
    if (!data.mobilePaymentIdNumber) ctx.addIssue({ code: 'custom', path: ['mobilePaymentIdNumber'], message: 'El número de ID es requerido.' });
  } else if (data.paymentMethod === 'usdt') {
    if (!data.usdtAddress) ctx.addIssue({ code: 'custom', path: ['usdtAddress'], message: 'El correo de Binance es requerido.' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.usdtAddress)) ctx.addIssue({ code: 'custom', path: ['usdtAddress'], message: 'Por favor, introduce un correo electrónico válido.' });
  }
});

type FormData = z.infer<typeof formSchema> & {
    bank: string;
    accountNumber: string;
    mobilePaymentBank: string;
    mobilePaymentPhoneCode: string;
    mobilePaymentPhoneNumber: string;
    mobilePaymentIdPrefix: string;
    mobilePaymentIdNumber: string;
    usdtPlatform: string;
    usdtAddress: string;
};

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
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const publisherRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'publishers', user.uid) : null, [firestore, user]);
  const { data: publisherData, isLoading: isLoadingData } = useDoc<PublisherDbData>(publisherRef);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        country: '', paymentMethod: '', bank: '', accountNumber: '',
        mobilePaymentBank: '', mobilePaymentPhoneCode: '', mobilePaymentPhoneNumber: '',
        mobilePaymentIdPrefix: '', mobilePaymentIdNumber: '', usdtPlatform: 'Binance', usdtAddress: ''
      }
  });
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (publisherData) {
        const data: Partial<FormData> = {
            country: publisherData.country || '',
            paymentMethod: publisherData.paymentMethod || '',
            bank: publisherData.bank || '',
            accountNumber: publisherData.accountNumber || '',
            mobilePaymentBank: publisherData.mobilePaymentBank || '',
            usdtPlatform: publisherData.usdtPlatform || 'Binance',
            usdtAddress: publisherData.usdtAddress || '',
        };
        if (publisherData.mobilePaymentPhone) {
            const code = publisherData.mobilePaymentPhone.substring(0, 4);
            if (phoneCodes.includes(code)) {
                data.mobilePaymentPhoneCode = code;
                data.mobilePaymentPhoneNumber = publisherData.mobilePaymentPhone.substring(4);
            }
        }
        if (publisherData.mobilePaymentId) {
            const prefix = publisherData.mobilePaymentId.charAt(0);
            if (idPrefixes.includes(prefix)) {
                data.mobilePaymentIdPrefix = prefix;
                data.mobilePaymentIdNumber = publisherData.mobilePaymentId.substring(1);
            }
        }
      reset(data);
    }
  }, [publisherData, reset]);

  const watchedCountry = watch('country');
  const watchedPaymentMethod = watch('paymentMethod');
  
  const handleCountryChange = (value: 'VE' | 'CO' | '') => {
      setValue('country', value);
      setValue('paymentMethod', '');
      // Clear all payment method specific fields
      setValue('bank', '');
      setValue('accountNumber', '');
      setValue('mobilePaymentBank', '');
      setValue('mobilePaymentPhoneCode', '');
      setValue('mobilePaymentPhoneNumber', '');
      setValue('mobilePaymentIdPrefix', '');
      setValue('mobilePaymentIdNumber', '');
      setValue('usdtAddress', '');
  }

  const handleSave = async (formData: FormData) => {
    setIsSaving(true);
    if (!publisherRef) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo obtener la referencia del usuario." });
        setIsSaving(false);
        return;
    }
    
    let dataToSave: PublisherDbData = {
        country: formData.country || undefined,
        paymentMethod: formData.paymentMethod || undefined,
    };

    if (formData.paymentMethod === 'transferencia') {
        dataToSave.bank = formData.bank;
        dataToSave.accountNumber = formData.accountNumber;
    } else if (formData.paymentMethod === 'pagoMovil') {
        dataToSave.mobilePaymentBank = formData.mobilePaymentBank;
        dataToSave.mobilePaymentPhone = `${formData.mobilePaymentPhoneCode}${formData.mobilePaymentPhoneNumber}`;
        dataToSave.mobilePaymentId = `${formData.mobilePaymentIdPrefix}${formData.mobilePaymentIdNumber}`;
    } else if (formData.paymentMethod === 'usdt') {
        dataToSave.usdtPlatform = 'Binance';
        dataToSave.usdtAddress = formData.usdtAddress;
    }
    
    try {
      await setDoc(publisherRef, { 
        ...dataToSave, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      toast({ title: "Configuración guardada", description: "Tus datos de pago se han actualizado correctamente." });
    } catch (error: any) {
      console.error("Firestore Save Error:", error);
      toast({ variant: 'destructive', title: "Error al guardar", description: error.message || "No se pudieron guardar los cambios." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const onInvalid = (errors: any) => {
      console.error("Validation Errors:", errors);
       toast({
        variant: 'destructive',
        title: "Formulario incompleto",
        description: "Por favor, revisa los campos marcados en rojo.",
      });
  }

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

      <form onSubmit={handleSubmit(handleSave, onInvalid)}>
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
                    <Select onValueChange={(val) => handleCountryChange(val as any)} value={field.value}>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={!watchedCountry}>
                            <SelectTrigger id="paymentMethod"><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                            <SelectContent>
                                {watchedCountry === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                                {(watchedCountry === 'VE' || watchedCountry === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                                <SelectItem value="usdt">USDT</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                 />
                {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
              </div>
            </div>

            {watchedPaymentMethod && <Separator />}

            {watchedPaymentMethod === 'transferencia' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Transferencia Bancaria</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank">Banco *</Label>
                    <Controller
                        name="bank"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                            <SelectContent>
                                {watchedCountry === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                {watchedCountry === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Número de Cuenta (20 dígitos) *</Label>
                    <Controller name="accountNumber" control={control} render={({ field }) => <Input {...field} id="accountNumber" placeholder="0102..." maxLength={20} />} />
                    {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {watchedPaymentMethod === 'pagoMovil' && watchedCountry === 'VE' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Pago Móvil (Solo Venezuela)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="mobilePaymentBank">Banco *</Label>
                    <Controller
                        name="mobilePaymentBank"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
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
                      <Label>Número de Teléfono *</Label>
                      <div className="flex gap-2">
                         <Controller
                            name="mobilePaymentPhoneCode"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-[120px]"><SelectValue placeholder="Código"/></SelectTrigger>
                                    <SelectContent>
                                        {phoneCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <Controller name="mobilePaymentPhoneNumber" control={control} render={({ field }) => <Input {...field} placeholder="XXXXXXX" maxLength={7} />} />
                      </div>
                      {errors.mobilePaymentPhoneCode && <p className="text-sm text-destructive">{errors.mobilePaymentPhoneCode.message}</p>}
                      {errors.mobilePaymentPhoneNumber && <p className="text-sm text-destructive">{errors.mobilePaymentPhoneNumber.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label>Cédula o RIF *</Label>
                    <div className="flex gap-2">
                        <Controller
                            name="mobilePaymentIdPrefix"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tipo"/></SelectTrigger>
                                    <SelectContent>
                                        {idPrefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <Controller name="mobilePaymentIdNumber" control={control} render={({ field }) => <Input {...field} placeholder="12345678" />} />
                    </div>
                     {errors.mobilePaymentIdPrefix && <p className="text-sm text-destructive">{errors.mobilePaymentIdPrefix.message}</p>}
                     {errors.mobilePaymentIdNumber && <p className="text-sm text-destructive">{errors.mobilePaymentIdNumber.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {watchedPaymentMethod === 'usdt' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de USDT</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="usdtPlatform">Plataforma</Label>
                    <Input id="usdtPlatform" value="Binance" readOnly className="bg-muted/50"/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usdtAddress">Correo electrónico de Binance *</Label>
                    <Controller name="usdtAddress" control={control} render={({ field }) => <Input {...field} id="usdtAddress" placeholder="tu.correo@email.com" />} />
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
