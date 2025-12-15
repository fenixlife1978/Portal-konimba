'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

import banksVe from '@/lib/banks-ve.json';
import banksCo from '@/lib/banks-co.json';

// Schemas for validation
const formSchema = z.object({
  country: z.string({ required_error: "Debes seleccionar un país." }).nonempty("Debes seleccionar un país."),
  paymentMethod: z.string({ required_error: "Debes seleccionar un método de pago." }).nonempty("Debes seleccionar un método de pago."),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  mobilePaymentPhone: z.string().optional(),
  mobilePaymentId: z.string().optional(),
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentMethod === 'pagoMovil' && data.country === 'VE') {
        if (!data.bank) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El banco es requerido.", path: ['bank'] });
        if (!data.mobilePaymentPhone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El teléfono es requerido.", path: ['mobilePaymentPhone'] });
        if (!data.mobilePaymentId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cédula/RIF es requerida.", path: ['mobilePaymentId'] });
    }
    if (data.paymentMethod === 'transferencia' && (data.country === 'VE' || data.country === 'CO')) {
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

// Form Component
function PaymentForm({
    form,
    onSubmit,
    onCancel,
    isSaving,
}: {
    form: UseFormReturn<FormData>;
    onSubmit: (data: FormData) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const { control, handleSubmit, watch, formState: { errors } } = form;
    const country = watch('country');
    const paymentMethod = watch('paymentMethod');

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Configurar Método de Pago</DialogTitle>
                <DialogDescription>
                    Completa los detalles para recibir tus ganancias. Los campos con * son requeridos.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                {paymentMethod === 'pagoMovil' && country === 'VE' && (
                    <>
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
                        <div className="space-y-2">
                            <Label htmlFor="mobilePaymentId">Cédula o RIF *</Label>
                            <Controller name="mobilePaymentId" control={control} render={({ field }) => <Input {...field} id="mobilePaymentId" placeholder="V-12345678" value={field.value || ''} />} />
                            {errors.mobilePaymentId && <p className="text-sm text-destructive">{errors.mobilePaymentId.message}</p>}
                        </div>
                    </>
                )}

                {paymentMethod === 'transferencia' && (country === 'VE' || country === 'CO') && (
                    <>
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
                    </>
                )}

                {paymentMethod === 'usdt' && (
                    <>
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
                    </>
                )}
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>) : 'Guardar Cambios'}
                </Button>
            </DialogFooter>
        </form>
    );
}


export default function SettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const { control, watch, reset, setValue, trigger } = form;

  useEffect(() => {
    if (publisherData) {
      reset(publisherData);
    }
  }, [publisherData, reset]);

  const country = watch('country');
  const paymentMethod = watch('paymentMethod');

  const handleCountryChange = (value: string) => {
    setValue('country', value);
    setValue('paymentMethod', '');
    setValue('bank', '');
    setValue('accountNumber', '');
    setValue('mobilePaymentPhone', '');
    setValue('mobilePaymentId', '');
    setValue('usdtPlatform', '');
    setValue('usdtAddress', '');
  };

  const handlePaymentMethodChange = (value: string) => {
      setValue('paymentMethod', value);
  }

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
      setIsModalOpen(false);
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

      <Card>
          <CardHeader>
            <CardTitle>Método de Pago</CardTitle>
            <CardDescription>
              Selecciona y configura cómo deseas recibir tus ganancias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="country">País de Origen</Label>
              <Select onValueChange={handleCountryChange} value={country}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Selecciona tu país" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VE">Venezuela</SelectItem>
                  <SelectItem value="CO">Colombia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {country && (
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                 <Select onValueChange={handlePaymentMethodChange} value={paymentMethod} disabled={!country}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Selecciona un método" />
                  </SelectTrigger>
                  <SelectContent>
                    {country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                    <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                    <SelectItem value="usdt">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {paymentMethod && (
              <div className="pt-4">
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" onClick={async () => {
                       const isValid = await trigger(['country', 'paymentMethod']);
                       if(isValid) setIsModalOpen(true);
                    }}>Configurar Detalles de Pago</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <PaymentForm
                        form={form}
                        onSubmit={onSubmit}
                        onCancel={() => setIsModalOpen(false)}
                        isSaving={isSaving}
                    />
                  </DialogContent>
                </Dialog>
                
                <div className="mt-4 text-sm text-muted-foreground p-4 border rounded-lg">
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
              </div>
            )}
          </CardContent>
      </Card>
    </div>
  );
}
