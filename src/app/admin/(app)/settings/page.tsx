'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDoc, useStorage, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  MessageSquare, 
  Building2, 
  Key, 
  Plus, 
  Globe,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

const systemSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  dbType: z.enum(['firebase', 'mongodb', 'turso']),
  dbConnectionString: z.string().optional(),
  dbAuthToken: z.string().optional(),
  dbServiceAccount: z.string().optional(),
  whatsappUrl: z.string().url('Debe ser una URL válida.').or(z.literal('')),
  whatsappToken: z.string().optional(),
  logoUrl: z.string().optional(),
  usdToVesRate: z.coerce.number().positive(),
  usdToCopRate: z.coerce.number().positive(),
});

type SystemFormData = z.infer<typeof systemSchema>;

export default function SystemSettingsPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<any>(settingsRef);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<SystemFormData>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      dbType: 'firebase',
      companyName: '',
      companyAddress: '',
      dbConnectionString: '',
      dbAuthToken: '',
      dbServiceAccount: '',
      whatsappUrl: '',
      whatsappToken: '',
      logoUrl: '',
      usdToVesRate: 1,
      usdToCopRate: 1,
    }
  });

  useEffect(() => {
    if (settingsData) {
      reset({
        companyName: settingsData.companyName || '',
        companyAddress: settingsData.companyAddress || '',
        dbType: settingsData.dbType || 'firebase',
        dbConnectionString: settingsData.dbConnectionString || '',
        dbAuthToken: settingsData.dbAuthToken || '',
        dbServiceAccount: settingsData.dbServiceAccount || '',
        whatsappUrl: settingsData.whatsappUrl || '',
        whatsappToken: settingsData.whatsappToken || '',
        logoUrl: settingsData.logoUrl || '',
        usdToVesRate: settingsData.usdToVesRate ?? 1,
        usdToCopRate: settingsData.usdToCopRate ?? 1,
      });
    }
  }, [settingsData, reset]);

  const dbType = watch('dbType');
  const logoUrl = watch('logoUrl');

  const onSubmit = (data: SystemFormData) => {
    if (!settingsRef) return;
    setIsSaving(true);
    setDocumentNonBlocking(settingsRef, data, { merge: true });
    toast({ title: "Motor actualizado", description: "La configuración del sistema se ha guardado correctamente." });
    setIsSaving(false);
  };

  const handleFileChange = (file: File) => {
    if (!storage || !file) return;
    setIsUploading(true);
    const logoStorageRef = storageRef(storage, `logos/system_logo_${Date.now()}`);
    const uploadTask = uploadBytesResumable(logoStorageRef, file);
    uploadTask.on('state_changed', 
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => { setIsUploading(false); toast({ variant: "destructive", title: "Error", description: err.message }); },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(url => {
          setValue('logoUrl', url);
          setIsUploading(false);
          toast({ title: "Logo cargado" });
        });
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Configuración del Sistema</h1>
          <p className="text-muted-foreground font-medium mt-1">El motor dinámico de tu plataforma</p>
        </div>
        <Button onClick={handleSubmit(onSubmit)} disabled={isSaving} className="rounded-2xl px-8 shadow-lg shadow-primary/20">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Guardar Cambios
        </Button>
      </div>

      <Tabs defaultValue="db" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-8 w-full md:w-fit overflow-x-auto">
          <TabsTrigger value="db" className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Database className="mr-2 h-4 w-4" /> Base de Datos
          </TabsTrigger>
          <TabsTrigger value="agencies" className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="mr-2 h-4 w-4" /> Integración CPA
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Gateway
          </TabsTrigger>
          <TabsTrigger value="company" className="rounded-xl px-6 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Globe className="mr-2 h-4 w-4" /> Empresa y Tasas
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="db">
            <Card className="rounded-2xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Conexión de Base de Datos</CardTitle>
                <CardDescription>Configura dónde se almacenará la información del portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <Label>Tipo de Proveedor</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {['firebase', 'mongodb', 'turso'].map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant={dbType === type ? 'default' : 'outline'}
                        className="rounded-xl h-24 flex-col gap-2 font-bold uppercase tracking-tight"
                        onClick={() => setValue('dbType', type as any)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                {dbType === 'firebase' && (
                  <div className="space-y-4">
                    <Label>Service Account JSON (Firestore/RTDB)</Label>
                    <Controller
                      name="dbServiceAccount"
                      control={control}
                      render={({ field }) => (
                        <Textarea 
                          {...field} 
                          placeholder='{ "type": "service_account", ... }' 
                          className="min-h-[200px] rounded-xl font-mono text-xs bg-muted/30"
                        />
                      )}
                    />
                  </div>
                )}

                {dbType !== 'firebase' && (
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Connection String (SRV / URL)</Label>
                      <Controller
                        name="dbConnectionString"
                        control={control}
                        render={({ field }) => <Input {...field} className="rounded-xl bg-muted/30" />}
                      />
                    </div>
                    {dbType === 'turso' && (
                      <div className="space-y-2">
                        <Label>Auth Token</Label>
                        <Controller
                          name="dbAuthToken"
                          control={control}
                          render={({ field }) => <Input {...field} type="password" className="rounded-xl bg-muted/30" />}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agencies">
            <Card className="rounded-2xl border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Agencias CPA Integradas</CardTitle>
                  <CardDescription>Gestiona las llaves de API para la sincronización de leads.</CardDescription>
                </div>
                <Button variant="outline" className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" /> Añadir Agencia
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/40">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">CP</div>
                    <div>
                      <h4 className="font-bold">Cpamerchant</h4>
                      <p className="text-xs text-muted-foreground">Sincronización quincenal activa</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl"><Key className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="rounded-xl text-destructive"><Plus className="h-4 w-4 rotate-45" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card className="rounded-2xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Pasarela de WhatsApp</CardTitle>
                <CardDescription>Configuración de Evolution API para notificaciones.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Instancia Server URL</Label>
                    <Controller
                      name="whatsappUrl"
                      control={control}
                      render={({ field }) => <Input {...field} placeholder="https://api.tuservidor.com" className="rounded-xl" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key / Token</Label>
                    <Controller
                      name="whatsappToken"
                      control={control}
                      render={({ field }) => <Input {...field} type="password" placeholder="Tu token secreto" className="rounded-xl" />}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
             <Card className="rounded-2xl border-none shadow-sm">
              <CardHeader>
                <CardTitle>Identidad y Finanzas</CardTitle>
                <CardDescription>Logo corporativo y tasas de cambio para nómina.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex items-start gap-8">
                  <div className="relative h-40 w-40 rounded-2xl bg-muted/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                    {logoUrl ? <Image src={logoUrl} alt="Logo" fill className="object-contain p-4" /> : <ImageIcon className="h-12 w-12 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 space-y-4">
                    <Label>Logo de la Empresa</Label>
                    <FileUpload onFileSelect={handleFileChange} disabled={isUploading} />
                    {isUploading && <Progress value={uploadProgress} className="h-2 rounded-full" />}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la Empresa</Label>
                    <Controller name="companyName" control={control} render={({ field }) => <Input {...field} className="rounded-xl" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección Corporativa</Label>
                    <Controller name="companyAddress" control={control} render={({ field }) => <Input {...field} className="rounded-xl" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tasa USD a Bolívares (VES)</Label>
                    <Controller name="usdToVesRate" control={control} render={({ field }) => <Input {...field} type="number" step="0.01" className="rounded-xl" />} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tasa USD a Pesos (COP)</Label>
                    <Controller name="usdToCopRate" control={control} render={({ field }) => <Input {...field} type="number" step="1" className="rounded-xl" />} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
