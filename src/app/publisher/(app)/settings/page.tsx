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

const formSchema = z.object({
  country: z.string().optional(),
  paymentMethod: z.string().optional(),
  // Transferencia
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  // Pago Movil
  mobilePaymentBank: z.string().optional(),
  mobilePaymentPhone: z.string().optional(),
  mobilePaymentId: z.string().optional(),
  // USDT
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
}).refine(data => {
    // Si se está configurando un método de pago, al menos se debe seleccionar el método
    if (data.bank || data.accountNumber || data.mobilePaymentBank || data.mobilePaymentPhone || data.mobilePaymentId || data.usdtPlatform || data.usdtAddress) {
        return !!data.paymentMethod;
    }
    return true;
}, {
    message: "Debes seleccionar un método de pago principal.",
    path: ["paymentMethod"],
})
.superRefine((data, ctx) => {
    // Valida Transferencia
    if (data.paymentMethod === 'transferencia') {
        if (!data.country) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El país es requerido.", path: ['country'] });
        if (!data.bank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['bank'] });
        if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El número de cuenta es requerido.", path: ['accountNumber'] });
    }
    // Valida Pago Movil
    if (data.paymentMethod === 'pagoMovil') {
        if (data.country !== 'VE') ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pago Móvil solo está disponible para Venezuela.", path: ['country'] });
        if (!data.mobilePaymentBank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido para Pago Móvil.", path: ['mobilePaymentBank'] });
        if (!data.mobilePaymentPhone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El teléfono es requerido.", path: ['mobilePaymentPhone'] });
        if (!data.mobilePaymentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cédula/RIF es requerida.", path: ['mobilePaymentId'] });
    }
    // Valida USDT
    if (data.paymentMethod === 'usdt') {
        if (!data.usdtPlatform) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La plataforma es requerida.", path: ['usdtPlatform'] });
        if (!data.usdtAddress) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La dirección o ID es requerida.", path: ['usdtAddress'] });
    }
});


type FormData = z.infer<typeof formSchema>;

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

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
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
      // Limpia los datos que no corresponden al método de pago seleccionado
      const finalData: Partial<FormData> = {
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
      
      await setDoc(publisherRef, {
        ...publisherData, // merge with existing data
        ...finalData,
        updatedAt: serverTimestamp(),
      }, { merge: true });

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
                Rellena los campos del método de pago que deseas utilizar. Solo se guardará la información del método que selecciones como principal.
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
                                <Select onValueChange={field.onChange} value={field.value}>
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

                <Separator />
                
                {/* --- SECCIÓN TRANSFERENCIA BANCARIA --- */}
                <div className='space-y-4'>
                    <h3 className="font-semibold text-lg text-foreground">Opción 1: Transferencia Bancaria (VE / CO)</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="bank">Banco</Label>
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
                            <Label htmlFor="accountNumber">Número de Cuenta</Label>
                            <Input id="accountNumber" {...register("accountNumber")} placeholder="0102..." />
                            {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                        </div>
                    </div>
                </div>

                <Separator />

                {/* --- SECCIÓN PAGO MÓVIL --- */}
                <div className='space-y-4'>
                     <h3 className="font-semibold text-lg text-foreground">Opción 2: Pago Móvil (Solo Venezuela)</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="space-y-2">
                            <Label htmlFor="mobilePaymentBank">Banco</Label>
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
                            <Label htmlFor="mobilePaymentPhone">Número de Teléfono</Label>
                            <Input id="mobilePaymentPhone" {...register("mobilePaymentPhone")} placeholder="04XX-XXXXXXX" disabled={country !== 'VE'}/>
                            {errors.mobilePaymentPhone && <p className="text-sm text-destructive">{errors.mobilePaymentPhone.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="mobilePaymentId">Cédula o RIF</Label>
                            <Input id="mobilePaymentId" {...register("mobilePaymentId")} placeholder="V-12345678" disabled={country !== 'VE'}/>
                            {errors.mobilePaymentId && <p className="text-sm text-destructive">{errors.mobilePaymentId.message}</p>}
                        </div>
                     </div>
                </div>
                
                <Separator />

                {/* --- SECCIÓN USDT --- */}
                <div className='space-y-4'>
                    <h3 className="font-semibold text-lg text-foreground">Opción 3: USDT</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="usdtPlatform">Plataforma</Label>
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
                            <Label htmlFor="usdtAddress">Dirección USDT (o ID de Pago)</Label>
                            <Input id="usdtAddress" {...register("usdtAddress")} placeholder="Tu dirección o ID de pago" />
                            {errors.usdtAddress && <p className="text-sm text-destructive">{errors.usdtAddress.message}</p>}
                        </div>
                    </div>
                </div>

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
