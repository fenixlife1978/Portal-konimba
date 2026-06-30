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
  X as CloseIcon,
  Play
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { initializeExternalDatabase } from '@/actions/db-actions';

const agencySchema = z.object({
  name: z.string().min(1, 'El nombre de la agencia es requerido.'),
  apiKey: z.string().optional().default(''),
  active: z.boolean().default(true),
});

const systemSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  dbType: z.enum(['firebase', 'mongodb', 'turso']),
  dbConnectionString: z.string().optional().default(''),
  dbAuthToken: z.string().optional().default(''),
  dbServiceAccount: z.string().optional().default(''),
  whatsappUrl: z.string().url('Debe ser una URL válida.').or(z.literal('')).default(''),
  whatsappToken: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
  usdToVesRate: z.coerce.number().positive().default(1),
  usdToCopRate: z.coerce.number().positive().default(1),
  agencies: z.array(agencySchema).default([]),
});

type SystemFormData = z.infer<typeof systemSchema>;
type Agency = z.infer<typeof agencySchema>;

export default function SystemSettingsPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // States for Agency Modal
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [currentAgencyIndex, setCurrentAgencyIndex] = useState<number | null>(null);
  const [tempApiKey, setTempApiKey] = useState('');

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
      agencies: [
        { name: 'Cpamerchant', apiKey: '', active: true }
      ],
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
        agencies: settingsData.agencies && settingsData.agencies.length > 0 
          ? settingsData.agencies 
          : [{ name: 'Cpamerchant', apiKey: '', active: true }],
      });
    }
  }, [settingsData, reset]);

  const dbType = watch('dbType');
  const logoUrl = watch('logoUrl');
  const agencies = watch('agencies');
  const currentDbConn = watch('dbConnectionString');
  const currentDbAuth = watch('dbAuthToken');

  const onSubmit = (data: SystemFormData) => {
    if (!settingsRef) return;
    setIsSaving(true);
    setDocumentNonBlocking(settingsRef, data, { merge: true });
    toast({ title: "Motor actualizado", description: "La configuración del sistema se ha guardado correctamente." });
    setIsSaving(false);
  };

  const handleInitializeDB = async () => {
    setIsInitializing(true);
    const result = await initializeExternalDatabase({
      dbType: dbType,
      dbConnectionString: currentDbConn,
      dbAuthToken: currentDbAuth
    });

    if (result.success) {
      toast({ title: "Éxito", description: result.message });
    } else {
      toast({ variant: 'destructive', title: "Fallo de Inicialización", description: result.message });
    }
    setIsInitializing(false);
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

  const openAgencyKeyModal = (index: number) => {
    setCurrentAgencyIndex(index);
    setTempApiKey(agencies[index].apiKey || '');
    setIsAgencyModalOpen(true);
  };

  const saveAgencyKey = () => {
    if (currentAgencyIndex !== null) {
      const updatedAgencies = [...agencies];
      updatedAgencies[currentAgencyIndex].apiKey = tempApiKey;
      setValue('agencies', updatedAgencies);
      setIsAgencyModalOpen(false);
      toast({ title: "API Key asignada", description: "No olvides pulsar 'Guardar Cambios' para aplicar." });
    }
  };

  const addAgency = () => {
    const newAgency: Agency = { name: 'Nueva Agencia', apiKey: '', active: true };
    setValue('agencies', [...agencies, newAgency]);
  };

  const removeAgency = (index: number) => {
    const updatedAgencies = agencies.filter((_, i) => i !== index);
    setValue('agencies', updatedAgencies);
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Conexión de Base de Datos</CardTitle>
                  <CardDescription>Configura dónde se almacenará la información del portal.</CardDescription>
                </div>
                {dbType !== 'firebase' && (
                  <Button variant="secondary" onClick={handleInitializeDB} disabled={isInitializing || !currentDbConn} className="rounded-xl">
                    {isInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Inicializar Tablas/Colecciones
                  </Button>
                )}
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
                <Button variant="outline" className="rounded-xl" onClick={addAgency}>
                  <Plus className="mr-2 h-4 w-4" /> Añadir Agencia
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {agencies.map((agency, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/40 group">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {agency.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold">{agency.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {agency.apiKey ? 'API Key configurada' : 'Falta configurar API Key'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl hover:bg-primary/10"
                        onClick={() => openAgencyKeyModal(index)}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl text-destructive hover:bg-destructive/10"
                        onClick={() => removeAgency(index)}
                      >
                        <CloseIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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

      {/* Agency API Key Modal */}
      <Dialog open={isAgencyModalOpen} onOpenChange={setIsAgencyModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Configurar API Key</DialogTitle>
            <DialogDescription>
              Introduce la llave de acceso para {currentAgencyIndex !== null ? agencies[currentAgencyIndex].name : 'la agencia'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Agencia</Label>
              <Input 
                value={currentAgencyIndex !== null ? agencies[currentAgencyIndex].name : ''} 
                onChange={(e) => {
                  if (currentAgencyIndex !== null) {
                    const updated = [...agencies];
                    updated[currentAgencyIndex].name = e.target.value;
                    setValue('agencies', updated);
                  }
                }}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Token de Acceso (API Key)</Label>
              <Input 
                type="password"
                placeholder="Pega aquí el token secreto" 
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgencyModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveAgencyKey} className="rounded-xl">Asignar Llave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
