'use client';
import { useEffect, useState } from 'react';
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

type FormData = {
  country: 'VE' | 'CO' | '';
  paymentMethod: 'transferencia' | 'pagoMovil' | 'usdt' | '';
  bank?: string;
  accountNumber?: string;
  mobilePaymentBank?: string;
  mobilePaymentPhoneCode?: string;
  mobilePaymentPhoneNumber?: string;
  mobilePaymentIdPrefix?: string;
  mobilePaymentIdNumber?: string;
  usdtAddress?: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const publisherRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'publishers', user.uid) : null, [firestore, user]);
  const { data: publisherData, isLoading: isLoadingData } = useDoc<any>(publisherRef);

  const [formData, setFormData] = useState<FormData>({
    country: '', paymentMethod: '', bank: '', accountNumber: '',
    mobilePaymentBank: '', mobilePaymentPhoneCode: '', mobilePaymentPhoneNumber: '',
    mobilePaymentIdPrefix: '', mobilePaymentIdNumber: '', usdtAddress: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (publisherData) {
        const data: Partial<FormData> = {
            country: publisherData.country || '',
            paymentMethod: publisherData.paymentMethod || '',
            bank: publisherData.bank || '',
            accountNumber: publisherData.accountNumber || '',
            mobilePaymentBank: publisherData.mobilePaymentBank || '',
            usdtAddress: publisherData.usdtAddress || '',
        };

        if (publisherData.mobilePaymentPhone) {
            const phoneString = String(publisherData.mobilePaymentPhone);
            const code = phoneString.substring(0, 4);
            if (phoneCodes.includes(code)) {
                data.mobilePaymentPhoneCode = code;
                data.mobilePaymentPhoneNumber = phoneString.substring(4);
            }
        }
        if (publisherData.mobilePaymentId) {
            const idString = String(publisherData.mobilePaymentId);
            const prefix = idString.charAt(0).toUpperCase();
            if (idPrefixes.includes(prefix)) {
                data.mobilePaymentIdPrefix = prefix;
                data.mobilePaymentIdNumber = idString.substring(1);
            }
        }
      setFormData(prev => ({...prev, ...data}));
    }
  }, [publisherData]);
  
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };
  
  const handleCountryChange = (value: 'VE' | 'CO' | '') => {
      setFormData({
        country: value,
        paymentMethod: '', bank: '', accountNumber: '',
        mobilePaymentBank: '', mobilePaymentPhoneCode: '', mobilePaymentPhoneNumber: '',
        mobilePaymentIdPrefix: '', mobilePaymentIdNumber: '', usdtAddress: ''
      });
      setErrors({});
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const { 
        country, paymentMethod, bank, accountNumber,
        mobilePaymentBank, mobilePaymentPhoneCode, mobilePaymentPhoneNumber,
        mobilePaymentIdPrefix, mobilePaymentIdNumber, usdtAddress
    } = formData;
    
    if (!country) newErrors.country = 'Debes seleccionar un país.';
    if (!paymentMethod) newErrors.paymentMethod = 'Debes seleccionar un método de pago.';
    
    if (paymentMethod === 'transferencia') {
        if (!bank) newErrors.bank = 'El banco es requerido.';
        if (!accountNumber) {
            newErrors.accountNumber = 'El número de cuenta es requerido.';
        } else if (country === 'VE' && !/^\d{20}$/.test(accountNumber)) {
            newErrors.accountNumber = 'La cuenta debe tener 20 dígitos.';
        }
    } else if (paymentMethod === 'pagoMovil' && country === 'VE') {
        if (!mobilePaymentBank) newErrors.mobilePaymentBank = 'El banco es requerido.';
        if (!mobilePaymentPhoneCode) newErrors.mobilePaymentPhoneCode = 'El código es requerido.';
        if (!mobilePaymentPhoneNumber) {
            newErrors.mobilePaymentPhoneNumber = 'El número es requerido.';
        } else if (!/^\d{7}$/.test(mobilePaymentPhoneNumber)) {
            newErrors.mobilePaymentPhoneNumber = 'El número debe tener 7 dígitos.';
        }
        if (!mobilePaymentIdPrefix) newErrors.mobilePaymentIdPrefix = 'El prefijo es requerido.';
        if (!mobilePaymentIdNumber) newErrors.mobilePaymentIdNumber = 'El número de ID es requerido.';
    } else if (paymentMethod === 'usdt') {
        if (!usdtAddress) {
            newErrors.usdtAddress = 'El correo de Binance es requerido.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usdtAddress)) {
            newErrors.usdtAddress = 'Por favor, introduce un correo electrónico válido.';
        }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (!validateForm()) {
        toast({ variant: 'destructive', title: "Formulario incompleto", description: "Por favor, revisa los campos marcados en rojo." });
        setIsSaving(false);
        return;
    }

    if (!publisherRef) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo obtener la referencia del usuario." });
        setIsSaving(false);
        return;
    }
    
    // Start with a clean slate for all payment fields to enforce one method at a time
    const dataToSave: any = {
        country: formData.country,
        paymentMethod: formData.paymentMethod,
        updatedAt: serverTimestamp(),
        // Clear all possible payment fields
        bank: null,
        accountNumber: null,
        mobilePaymentBank: null,
        mobilePaymentPhone: null,
        mobilePaymentId: null,
        usdtPlatform: null,
        usdtAddress: null,
    };

    // Conditionally add fields based on the selected payment method
    if (formData.paymentMethod === 'transferencia') {
        dataToSave.bank = formData.bank;
        dataToSave.accountNumber = formData.accountNumber;
    } else if (formData.paymentMethod === 'pagoMovil' && formData.country === 'VE') {
        dataToSave.mobilePaymentBank = formData.mobilePaymentBank;
        dataToSave.mobilePaymentPhone = `${formData.mobilePaymentPhoneCode}${formData.mobilePaymentPhoneNumber}`;
        dataToSave.mobilePaymentId = `${formData.mobilePaymentIdPrefix}${formData.mobilePaymentIdNumber}`;
    } else if (formData.paymentMethod === 'usdt') {
        dataToSave.usdtPlatform = 'Binance';
        dataToSave.usdtAddress = formData.usdtAddress;
    }
    
    try {
      await setDoc(publisherRef, dataToSave, { merge: true });
      toast({ title: "Configuración guardada", description: "Tus datos de pago se han actualizado correctamente." });
    } catch (error: any) {
      console.error("Firestore Save Error:", error);
      toast({ variant: 'destructive', title: "Error al guardar", description: error.message || "No se pudieron guardar los cambios." });
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
        <h1 className="text-3xl font-bold font-headline text-foreground">Configuración de Pagos</h1>
        <Button asChild variant="outline">
          <Link href="/publisher"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Método de Pago</CardTitle>
            <CardDescription>
              Selecciona tu país y método de pago. Luego, completa los campos requeridos para ese método. Solo puedes tener un método activo a la vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="country">País de Residencia *</Label>
                <Select onValueChange={(val: 'VE' | 'CO' | '') => handleCountryChange(val)} value={formData.country}>
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
                 <Select onValueChange={(val) => handleInputChange('paymentMethod', val)} value={formData.paymentMethod} disabled={!formData.country}>
                    <SelectTrigger id="paymentMethod"><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                    <SelectContent>
                        {formData.country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                        {(formData.country === 'VE' || formData.country === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                        <SelectItem value="usdt">USDT (Binance)</SelectItem>
                    </SelectContent>
                </Select>
                {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod}</p>}
              </div>
            </div>

            {formData.paymentMethod && <Separator />}

            {formData.paymentMethod === 'transferencia' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Transferencia Bancaria</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank">Banco *</Label>
                    <Select onValueChange={(val) => handleInputChange('bank', val)} value={formData.bank}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                        <SelectContent>
                            {formData.country === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                            {formData.country === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {errors.bank && <p className="text-sm text-destructive">{errors.bank}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Número de Cuenta *</Label>
                    <Input id="accountNumber" value={formData.accountNumber} onChange={(e) => handleInputChange('accountNumber', e.target.value)} placeholder={formData.country === 'VE' ? '20 dígitos para Venezuela' : 'Número de cuenta para Colombia'} maxLength={formData.country === 'VE' ? 20 : undefined} />
                    {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber}</p>}
                  </div>
                </div>
              </div>
            )}

            {formData.paymentMethod === 'pagoMovil' && formData.country === 'VE' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de Pago Móvil (Solo Venezuela)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="mobilePaymentBank">Banco *</Label>
                    <Select onValueChange={(val) => handleInputChange('mobilePaymentBank', val)} value={formData.mobilePaymentBank}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                        <SelectContent>
                            {banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {errors.mobilePaymentBank && <p className="text-sm text-destructive">{errors.mobilePaymentBank}</p>}
                  </div>
                  <div className="space-y-2">
                      <Label>Número de Teléfono *</Label>
                      <div className="flex gap-2">
                         <Select onValueChange={(val) => handleInputChange('mobilePaymentPhoneCode', val)} value={formData.mobilePaymentPhoneCode}>
                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Código"/></SelectTrigger>
                            <SelectContent>
                                {phoneCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input value={formData.mobilePaymentPhoneNumber} onChange={(e) => handleInputChange('mobilePaymentPhoneNumber', e.target.value)} placeholder="XXXXXXX" maxLength={7} />
                      </div>
                      {errors.mobilePaymentPhoneCode && !errors.mobilePaymentPhoneNumber && <p className="text-sm text-destructive">{errors.mobilePaymentPhoneCode}</p>}
                      {errors.mobilePaymentPhoneNumber && <p className="text-sm text-destructive">{errors.mobilePaymentPhoneNumber}</p>}
                  </div>
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label>Cédula o RIF *</Label>
                    <div className="flex gap-2">
                        <Select onValueChange={(val) => handleInputChange('mobilePaymentIdPrefix', val)} value={formData.mobilePaymentIdPrefix}>
                            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tipo"/></SelectTrigger>
                            <SelectContent>
                                {idPrefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input value={formData.mobilePaymentIdNumber} onChange={(e) => handleInputChange('mobilePaymentIdNumber', e.target.value)} placeholder="12345678" />
                    </div>
                     {errors.mobilePaymentIdPrefix && !errors.mobilePaymentIdNumber && <p className="text-sm text-destructive">{errors.mobilePaymentIdPrefix}</p>}
                     {errors.mobilePaymentIdNumber && <p className="text-sm text-destructive">{errors.mobilePaymentIdNumber}</p>}
                  </div>
                </div>
              </div>
            )}

            {formData.paymentMethod === 'usdt' && (
              <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <h3 className="font-semibold text-lg text-foreground">Detalles de USDT</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="usdtPlatform">Plataforma</Label>
                    <Input id="usdtPlatform" value="Binance" readOnly className="bg-muted/50"/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usdtAddress">Correo electrónico de Binance *</Label>
                    <Input id="usdtAddress" value={formData.usdtAddress} onChange={(e) => handleInputChange('usdtAddress', e.target.value)} placeholder="tu.correo@email.com" />
                    {errors.usdtAddress && <p className="text-sm text-destructive">{errors.usdtAddress}</p>}
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
