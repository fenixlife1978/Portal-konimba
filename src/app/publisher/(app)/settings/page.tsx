'use client';
import { useState, useEffect } from 'react';
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

type PublisherData = {
  country?: 'VE' | 'CO' | '';
  paymentMethod?: 'transferencia' | 'pagoMovil' | 'usdt' | '';
  bank?: string;
  accountNumber?: string;
  mobilePaymentBank?: string;
  mobilePaymentPhone?: string;
  mobilePaymentId?: string;
  usdtPlatform?: string;
  usdtAddress?: string;
};

type FormErrors = {
  [key in keyof PublisherData]?: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<PublisherData>({
    country: '',
    paymentMethod: '',
    bank: '',
    accountNumber: '',
    mobilePaymentBank: '',
    mobilePaymentPhone: '',
    mobilePaymentId: '',
    usdtPlatform: '',
    usdtAddress: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const publisherRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'publishers', user.uid);
  }, [firestore, user]);

  const { data: publisherData, isLoading: isLoadingData } = useDoc<PublisherData>(publisherRef);

  useEffect(() => {
    if (publisherData) {
      setFormData(prev => ({ ...prev, ...publisherData }));
    }
  }, [publisherData]);
  
  const handleInputChange = (field: keyof PublisherData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const { paymentMethod, country } = formData;

    if (!paymentMethod) {
      newErrors.paymentMethod = "Debes seleccionar un método de pago.";
    }
    if (!country) {
      newErrors.country = "Debes seleccionar un país.";
    }

    if (paymentMethod === 'transferencia') {
      if (!formData.bank) newErrors.bank = "El banco es requerido.";
      if (!formData.accountNumber) newErrors.accountNumber = "El número de cuenta es requerido.";
    } else if (paymentMethod === 'pagoMovil') {
      if (country !== 'VE') newErrors.country = "Pago Móvil solo está disponible para Venezuela.";
      if (!formData.mobilePaymentBank) newErrors.mobilePaymentBank = "El banco es requerido.";
      if (!formData.mobilePaymentPhone) newErrors.mobilePaymentPhone = "El teléfono es requerido.";
      if (!formData.mobilePaymentId) newErrors.mobilePaymentId = "La cédula/RIF es requerida.";
    } else if (paymentMethod === 'usdt') {
      if (!formData.usdtPlatform) newErrors.usdtPlatform = "La plataforma es requerida.";
      if (!formData.usdtAddress) newErrors.usdtAddress = "La dirección o ID es requerida.";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        variant: 'destructive',
        title: "Formulario incompleto",
        description: "Por favor, corrige los errores antes de guardar.",
      });
      return;
    }
    
    if (!publisherRef) return;
    setIsSaving(true);

    try {
      const dataToSave: any = {
        country: formData.country,
        paymentMethod: formData.paymentMethod,
        updatedAt: serverTimestamp()
      };

      if (formData.paymentMethod === 'transferencia') {
        dataToSave.bank = formData.bank;
        dataToSave.accountNumber = formData.accountNumber;
      }
      if (formData.paymentMethod === 'pagoMovil') {
        dataToSave.mobilePaymentBank = formData.mobilePaymentBank;
        dataToSave.mobilePaymentPhone = formData.mobilePaymentPhone;
        dataToSave.mobilePaymentId = formData.mobilePaymentId;
      }
      if (formData.paymentMethod === 'usdt') {
        dataToSave.usdtPlatform = formData.usdtPlatform;
        dataToSave.usdtAddress = formData.usdtAddress;
      }

      await setDoc(publisherRef, dataToSave, { merge: true });
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

  const currentCountry = formData.country;
  const paymentMethod = formData.paymentMethod;

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
              <Select onValueChange={(value: 'VE' | 'CO' | '' ) => handleInputChange('country', value)} value={formData.country}>
                <SelectTrigger id="country"><SelectValue placeholder="Selecciona tu país" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VE">Venezuela</SelectItem>
                  <SelectItem value="CO">Colombia</SelectItem>
                </SelectContent>
              </Select>
              {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pago Principal *</Label>
              <Select onValueChange={(value: 'transferencia' | 'pagoMovil' | 'usdt' | '') => handleInputChange('paymentMethod', value)} value={formData.paymentMethod} disabled={!currentCountry}>
                <SelectTrigger id="paymentMethod"><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                <SelectContent>
                  {currentCountry === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                  {(currentCountry === 'VE' || currentCountry === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                  <SelectItem value="usdt">USDT</SelectItem>
                </SelectContent>
              </Select>
              {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod}</p>}
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
                  <Select onValueChange={(value) => handleInputChange('bank', value)} value={formData.bank || ''} disabled={!currentCountry}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                    <SelectContent>
                      {currentCountry === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                      {currentCountry === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.bank && <p className="text-sm text-destructive">{errors.bank}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Número de Cuenta *</Label>
                  <Input id="accountNumber" value={formData.accountNumber} onChange={(e) => handleInputChange('accountNumber', e.target.value)} placeholder="0102..." />
                  {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber}</p>}
                </div>
              </div>
            </div>
          )}

          {/* --- SECCIÓN PAGO MÓVIL --- */}
          {paymentMethod === 'pagoMovil' && currentCountry === 'VE' && (
            <div className='space-y-4 animate-in fade-in-0 duration-300'>
              <h3 className="font-semibold text-lg text-foreground">Detalles de Pago Móvil (Solo Venezuela)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="mobilePaymentBank">Banco *</Label>
                  <Select onValueChange={(value) => handleInputChange('mobilePaymentBank', value)} value={formData.mobilePaymentBank || ''}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                    <SelectContent>
                      {banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.mobilePaymentBank && <p className="text-sm text-destructive">{errors.mobilePaymentBank}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobilePaymentPhone">Número de Teléfono *</Label>
                  <Input id="mobilePaymentPhone" value={formData.mobilePaymentPhone} onChange={(e) => handleInputChange('mobilePaymentPhone', e.target.value)} placeholder="04XX-XXXXXXX" />
                  {errors.mobilePaymentPhone && <p className="text-sm text-destructive">{errors.mobilePaymentPhone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobilePaymentId">Cédula o RIF *</Label>
                  <Input id="mobilePaymentId" value={formData.mobilePaymentId} onChange={(e) => handleInputChange('mobilePaymentId', e.target.value)} placeholder="V-12345678" />
                  {errors.mobilePaymentId && <p className="text-sm text-destructive">{errors.mobilePaymentId}</p>}
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
                  <Select onValueChange={(value) => handleInputChange('usdtPlatform', value)} value={formData.usdtPlatform || ''}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una plataforma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="binance">Binance</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.usdtPlatform && <p className="text-sm text-destructive">{errors.usdtPlatform}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usdtAddress">Dirección USDT (o ID de Pago) *</Label>
                  <Input id="usdtAddress" value={formData.usdtAddress} onChange={(e) => handleInputChange('usdtAddress', e.target.value)} placeholder="Tu dirección o ID de pago" />
                  {errors.usdtAddress && <p className="text-sm text-destructive">{errors.usdtAddress}</p>}
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <div className="p-6 pt-0">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>) : 'Guardar Cambios'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
