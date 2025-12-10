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
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import banksVe from '@/lib/banks-ve.json';
import banksCo from '@/lib/banks-co.json';

// Schemas for validation
const formSchema = z.object({
  country: z.string().nonempty("Debes seleccionar un país."),
  paymentMethod: z.string().nonempty("Debes seleccionar un método de pago."),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  mobilePaymentPhone: z.string().optional(),
  mobilePaymentId: z.string().optional(),
  usdtPlatform: z.string().optional(),
  usdtAddress: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const publisherRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'publishers', user.uid);
  }, [firestore, user]);

  const { data: publisherData, isLoading: isLoadingData } = useDoc(publisherRef);

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
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

  useEffect(() => {
    if (publisherData) {
      reset({
        country: publisherData.country || '',
        paymentMethod: publisherData.paymentMethod || '',
        bank: publisherData.bank || '',
        accountNumber: publisherData.accountNumber || '',
        mobilePaymentPhone: publisherData.mobilePaymentPhone || '',
        mobilePaymentId: publisherData.mobilePaymentId || '',
        usdtPlatform: publisherData.usdtPlatform || '',
        usdtAddress: publisherData.usdtAddress || '',
      });
    }
  }, [publisherData, reset]);

  const country = watch('country');
  const paymentMethod = watch('paymentMethod');

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const onSubmit = async (data: FormData) => {
    if (!publisherRef) return;
    try {
      await setDoc(publisherRef, {
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast({
        title: "Configuración guardada",
        description: "Tus datos de pago se han actualizado correctamente.",
      });
      setIsModalOpen(false); // Cierra el modal al guardar
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los cambios.",
      });
    }
  };

  const renderBankList = () => {
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
  
  const renderPaymentFields = () => {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Método de Pago</DialogTitle>
          <DialogDescription>
            Completa los detalles para recibir tus ganancias.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {paymentMethod === 'pagoMovil' && country === 'VE' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bank">Banco</Label>
                 <Controller
                  name="bank"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un banco" />
                      </SelectTrigger>
                      <SelectContent>{renderBankList()}</SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobilePaymentPhone">Número de Teléfono</Label>
                <Controller name="mobilePaymentPhone" control={control} render={({ field }) => <Input {...field} id="mobilePaymentPhone" placeholder="04XX-XXXXXXX" value={field.value || ''} />} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobilePaymentId">Cédula o RIF</Label>
                <Controller name="mobilePaymentId" control={control} render={({ field }) => <Input {...field} id="mobilePaymentId" placeholder="V-12345678" value={field.value || ''} />} />
              </div>
            </>
          )}

          {paymentMethod === 'transferencia' && (country === 'VE' || country === 'CO') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bank">Banco</Label>
                <Controller
                  name="bank"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un banco" />
                      </SelectTrigger>
                      <SelectContent>{renderBankList()}</SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Número de Cuenta</Label>
                <Controller name="accountNumber" control={control} render={({ field }) => <Input {...field} id="accountNumber" placeholder="0102..." value={field.value || ''} />} />
              </div>
            </>
          )}
          
          {paymentMethod === 'usdt' && (
            <>
               <div className="space-y-2">
                <Label htmlFor="usdtPlatform">Plataforma</Label>
                <Controller
                  name="usdtPlatform"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="binance">Binance</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="usdtAddress">Dirección USDT (o ID de Pago)</Label>
                <Controller name="usdtAddress" control={control} render={({ field }) => <Input {...field} id="usdtAddress" placeholder="Tu dirección o ID de pago" value={field.value || ''} />} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
           <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
          <Button type="submit" form="payment-form">Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    );
  };

  if (isLoadingData) {
    return <p>Cargando configuración...</p>;
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
        <form id="payment-form" onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Método de Pago</CardTitle>
            <CardDescription>
              Selecciona y configura cómo deseas recibir tus ganancias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="country">País de Origen</Label>
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
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

            {country && (
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                 <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={!country}>
                      <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                      <SelectContent>
                        {country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                        <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                        <SelectItem value="usdt">USDT</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
              </div>
            )}

            {paymentMethod && (
              <div className="pt-4">
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button>Configurar Detalles de Pago</Button>
                  </DialogTrigger>
                  {renderPaymentFields()}
                </Dialog>
                <div className="mt-4 text-sm text-muted-foreground p-4 border rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">Configuración Actual:</h4>
                  {publisherData?.country && <p><strong>País:</strong> {publisherData.country === 'VE' ? 'Venezuela' : 'Colombia'}</p>}
                  {publisherData?.paymentMethod && <p><strong>Método:</strong> {publisherData.paymentMethod}</p>}
                  {publisherData?.bank && <p><strong>Banco:</strong> {publisherData.bank}</p>}
                  {publisherData?.accountNumber && <p><strong>Nº Cuenta:</strong> {publisherData.accountNumber}</p>}
                  {publisherData?.mobilePaymentPhone && <p><strong>Teléfono:</strong> {publisherData.mobilePaymentPhone}</p>}
                  {publisherData?.mobilePaymentId && <p><strong>ID:</strong> {publisherData.mobilePaymentId}</p>}
                  {publisherData?.usdtPlatform && <p><strong>Plataforma USDT:</strong> {publisherData.usdtPlatform}</p>}
                  {publisherData?.usdtAddress && <p><strong>Dirección USDT:</strong> {publisherData.usdtAddress}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
