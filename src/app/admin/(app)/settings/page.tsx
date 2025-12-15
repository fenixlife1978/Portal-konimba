'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, UploadCloud, Building, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

const settingsSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  logoUrl: z.string().url('Debe ser una URL válida.').or(z.literal('')),
  usdToVesRate: z.coerce.number().positive('La tasa debe ser un número positivo.'),
  usdToCopRate: z.coerce.number().positive('La tasa debe ser un número positivo.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData, isLoading } = useDoc<SettingsFormData>(settingsRef);
  
  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: '',
      companyAddress: '',
      logoUrl: '',
      usdToVesRate: 0,
      usdToCopRate: 0,
    }
  });

  useEffect(() => {
    if (settingsData) {
      reset(settingsData);
    }
  }, [settingsData, reset]);

  const onSubmit = async (data: SettingsFormData) => {
    if (!settingsRef) return;
    setIsSaving(true);
    try {
      await setDoc(settingsRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({
        title: "Configuración Guardada",
        description: "Los datos de la empresa se han actualizado correctamente.",
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los cambios."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const logoUrl = watch('logoUrl');

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Configuración de la Empresa
        </h1>
        <Button asChild variant="outline">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
            <CardDescription>
              Gestiona los datos principales y el logo de tu empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                {logoUrl ? (
                  <Image src={logoUrl} alt="Logo" width={128} height={128} className="object-contain rounded-lg" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                 <Label htmlFor="logoUrl">URL del Logo</Label>
                 <div className="flex gap-2">
                   <Controller
                      name="logoUrl"
                      control={control}
                      render={({ field }) => (
                        <Input 
                          {...field}
                          id="logoUrl" 
                          placeholder="https://example.com/logo.png" 
                        />
                      )}
                    />
                    <Button type="button" variant="outline" disabled>
                      <UploadCloud className="mr-2 h-4 w-4" /> Subir
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground">Pega la URL de una imagen alojada. La función de subida directa estará disponible próximamente.</p>
                 {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de la Empresa</Label>
              <Controller
                name="companyName"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="companyName" placeholder="Ej: Siren's Portal Inc." />
                )}
              />
              {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
            </div>

             <div className="space-y-2">
              <Label htmlFor="companyAddress">Dirección de la Empresa</Label>
              <Controller
                name="companyAddress"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="companyAddress" placeholder="Ej: Av. Principal, Edificio Central, Piso 1" />
                )}
              />
              {errors.companyAddress && <p className="text-sm text-destructive">{errors.companyAddress.message}</p>}
            </div>
          </CardContent>

          <Separator className="my-6" />

           <CardHeader>
            <CardTitle>Tasas de Cambio</CardTitle>
            <CardDescription>
              Establece las tasas de conversión para los pagos quincenales.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="usdToVesRate">Tasa USD a Bolívares (VES)</Label>
              <Controller
                name="usdToVesRate"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="usdToVesRate" type="number" step="0.01" placeholder="Ej: 39.50" />
                )}
              />
              {errors.usdToVesRate && <p className="text-sm text-destructive">{errors.usdToVesRate.message}</p>}
            </div>
             <div className="space-y-2">
              <Label htmlFor="usdToCopRate">Tasa USD a Pesos Colombianos (COP)</Label>
              <Controller
                name="usdToCopRate"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="usdToCopRate" type="number" step="0.01" placeholder="Ej: 3900.00" />
                )}
              />
              {errors.usdToCopRate && <p className="text-sm text-destructive">{errors.usdToCopRate.message}</p>}
            </div>
          </CardContent>
          <div className="p-6 pt-0">
             <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
