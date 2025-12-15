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

// Schema for validation
const formSchema = z.object({
  country: z.string().nonempty("Debes seleccionar un país."),
  paymentMethod: z.string().nonempty("Debes seleccionar un método de pago."),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  mobilePaymentPhone: z.string().optional(),
  mobilePaymentId: z.string().optional(),
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentMethod === 'pagoMovil') {
        if (data.country !== 'VE') {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pago Móvil solo está disponible para Venezuela.", path: ['paymentMethod'] });
             return;
        }
        if (!data.bank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['bank'] });
        if (!data.mobilePaymentPhone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El teléfono es requerido.", path: ['mobilePaymentPhone'] });
        if (!data.mobilePaymentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cédula/RIF es requerida.", path: ['mobilePaymentId'] });
    }
    if (data.paymentMethod === 'transferencia') {
        if (!data.bank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['bank'] });
        if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El número de cuenta es requerido.", path: ['accountNumber'] });
    }
    if (data.paymentMethod === 'usdt') {
        if (!data.usdtPlatform) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La plataforma es requerida.", path: ['usdtPlatform'] });
        if (!data.usdtAddress) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La dirección o ID es requerida.", path: ['usdtAddress'] });
    }
});

type FormData = z.infer<typeof formSchema>;

const renderBankList = (country: string) => {
    if (country === 'VE') {
      return banksVe.map((bank) => (
        <SelectItem key={bank.id} value={bank.name}>{bank.name}</SelectItem>
      ));
    }
    if (country === 'CO') {
      return banksCo.map((bank) => (
        <SelectItem key={bank.code} value={bank.name}>{bank.name}</SelectItem>
      ));
    }
    return null;
};


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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      country: '',
      paymentMethod: '',
      bank: '',
      accountNumber: '',
      mobilePaymentPhone: '',
      mobilePaymentId: '',
      usdtPlatform: '',
      usdtAddress: '',
    },
  });

  const { control, watch, reset, setValue, formState: { errors } } = form;

  useEffect(() => {
    if (publisherData) {
      reset(publisherData);
    }
  }, [publisherData, reset]);

  const country = watch('country');
  const paymentMethod = watch('paymentMethod');

  const onSubmit = async (data: FormData) => {
    if (!publisherRef) return;
    setIsSaving(true);
    try {
      await setDoc(publisherRef, {
        ...data,
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

  const handleCountryChange = (value: string) => {
    setValue('country', value, { shouldValidate: true });
    // Reset dependent fields
    setValue('paymentMethod', '', { shouldValidate: true });
    setValue('bank', '', { shouldValidate: false });
    setValue('accountNumber', '', { shouldValidate: false });
    setValue('mobilePaymentPhone', '', { shouldValidate: false });
    setValue('mobilePaymentId', '', { shouldValidate: false });
  };
  
  const handlePaymentMethodChange = (value: string) => {
    setValue('paymentMethod', value, { shouldValidate: true });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Configuración de Pagos
        </h1>
        <Button asChild variant="outline">
          <Link href="/publisher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
            <CardHeader>
              <CardTitle>Método de Pago</CardTitle>
              <CardDescription>
                Selecciona y configura cómo deseas recibir tus ganancias. Los campos con * son requeridos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               {/* CURRENT DATA DISPLAY */}
               <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold text-foreground mb-2">Configuración Actual:</h4>
                  {publisherData?.country ? (
                    <div className="space-y-1">
                      <p><strong>País:</strong> {publisherData.country === 'VE' ? 'Venezuela' : publisherData.country === 'CO' ? 'Colombia' : publisherData.country}</p>
                      {publisherData.paymentMethod && <p><strong>Método:</strong> {publisherData.paymentMethod}</p>}
                      {publisherData.bank && <p><strong>Banco:</strong> {publisherData.bank}</p>}
                      {publisherData.accountNumber && <p><strong>Nº Cuenta:</strong> {publisherData.accountNumber}</p>}
                      {publisherData.mobilePaymentPhone && <p><strong>Teléfono:</strong> {publisherData.mobilePaymentPhone}</p>}
                      {publisherData.mobilePaymentId && <p><strong>ID:</strong> {publisherData.mobilePaymentId}</p>}
                      {publisherData.usdtPlatform && <p><strong>Plataforma USDT:</strong> {publisherData.usdtPlatform}</p>}
                      {publisherData.usdtAddress && <p><strong>Dirección USDT:</strong> {publisherData.usdtAddress}</p>}
                    </div>
                  ) : (
                    <p>Aún no has configurado un método de pago.</p>
                  )}
                </div>

              <Separator />

              <h3 className="text-lg font-medium text-foreground">Editar Configuración</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="country">País de Origen *</Label>
                   <Controller
                      name="country"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={handleCountryChange} value={field.value}>
                          <SelectTrigger id="country">
                            <SelectValue placeholder="Selecciona tu país" />
                          </SelectTrigger>
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
                  <Label htmlFor="paymentMethod">Método de Pago *</Label>
                  <Controller
                      name="paymentMethod"
                      control={control}
                      render={({ field }) => (
                         <Select onValueChange={handlePaymentMethodChange} value={field.value} disabled={!country}>
                          <SelectTrigger id="paymentMethod">
                            <SelectValue placeholder="Selecciona un método" />
                          </SelectTrigger>
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
              
              {/* CONDITIONAL FIELDS */}
              {paymentMethod && <Separator className="my-6" />}
              
              {paymentMethod === 'pagoMovil' && country === 'VE' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-0">
                      <div className="space-y-2">
                          <Label htmlFor="bank">Banco *</Label>
                          <Controller
                              name="bank"
                              control={control}
                              render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                      <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                                      <SelectContent>{renderBankList(country)}</SelectContent>
                                  </Select>
                              )}
                          />
                          {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="mobilePaymentPhone">Número de Teléfono *</Label>
                          <Controller name="mobilePaymentPhone" control={control} render={({ field }) => <Input {...field} id="mobilePaymentPhone" placeholder="04XX-XXXXXXX" value={field.value || ''} />} />
                          {errors.mobilePaymentPhone && <p className="text-sm text-destructive">{errors.mobilePaymentPhone.message}</p>}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="mobilePaymentId">Cédula o RIF *</Label>
                          <Controller name="mobilePaymentId" control={control} render={({ field }) => <Input {...field} id="mobilePaymentId" placeholder="V-12345678" value={field.value || ''} />} />
                          {errors.mobilePaymentId && <p className="text-sm text-destructive">{errors.mobilePaymentId.message}</p>}
                      </div>
                  </div>
              )}

              {paymentMethod === 'transferencia' && (country === 'VE' || country === 'CO') && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-0">
                      <div className="space-y-2">
                          <Label htmlFor="bank">Banco *</Label>
                          <Controller
                              name="bank"
                              control={control}
                              render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                      <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                                      <SelectContent>{renderBankList(country)}</SelectContent>
                                  </Select>
                              )}
                          />
                          {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="accountNumber">Número de Cuenta *</Label>
                          <Controller name="accountNumber" control={control} render={({ field }) => <Input {...field} id="accountNumber" placeholder="0102..." value={field.value || ''} />} />
                          {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                      </div>
                  </div>
              )}

              {paymentMethod === 'usdt' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-0">
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
                          <Controller name="usdtAddress" control={control} render={({ field }) => <Input {...field} id="usdtAddress" placeholder="Tu dirección o ID de pago" value={field.value || ''} />} />
                          {errors.usdtAddress && <p className="text-sm text-destructive">{errors.usdtAddress.message}</p>}
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
