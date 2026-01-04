'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDoc, useStorage, useFirestore } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';
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

const settingsSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email('Debe ser un email válido.').or(z.literal('')),
  companySocialMedia: z.string().optional(),
  logoUrl: z.string().url('Debe ser una URL válida.').or(z.literal('')),
  usdToVesRate: z.coerce.number().positive('La tasa debe ser un número positivo.'),
  usdToCopRate: z.coerce.number().positive('La tasa debe ser un número positivo.'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// URL Dialog Component
function UrlUploadDialog({ onSave }: { onSave: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    // Basic URL validation
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      onSave(url);
      setOpen(false);
    } else {
      // You can add a toast here for invalid URL
      console.error("Invalid URL");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="mr-2 h-4 w-4" />
          Usar URL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir Logo desde URL</DialogTitle>
          <DialogDescription>
            Pega la dirección URL de la imagen que quieres usar como logo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="logo-url-input">URL de la Imagen</Label>
          <Input 
            id="logo-url-input" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ejemplo.com/logo.png"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={handleSave}>Guardar URL</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function SettingsPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData, isLoading } = useDoc<SettingsFormData>(settingsRef);
  
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: '',
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companySocialMedia: '',
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

  const handleFileChange = (file: File) => {
    if (!storage) {
        toast({
            variant: "destructive",
            title: "Error de Storage",
            description: "El servicio de almacenamiento no está disponible.",
        });
        return;
    }
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Tipo de archivo no permitido",
        description: "Por favor, sube una imagen en formato JPG, JPEG o PNG.",
      });
      return;
    }

    setUploadProgress(0);
    setIsUploading(true);
    const logoStorageRef = storageRef(storage, `logos/company_logo_${Date.now()}`);
    const uploadTask = uploadBytesResumable(logoStorageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error", error);
        toast({
          variant: "destructive",
          title: "Error al subir el logo",
          description: error.message || "No se pudo subir el archivo. Revisa las reglas de Storage.",
        });
        setIsUploading(false);
        setUploadProgress(0);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setValue('logoUrl', downloadURL, { shouldValidate: true });
          toast({
            title: "Logo subido",
            description: "La imagen se ha subido correctamente. No olvides guardar los cambios.",
          });
          setIsUploading(false);
        });
      }
    );
  };

  const handleUrlSave = (url: string) => {
    setValue('logoUrl', url, { shouldValidate: true });
    toast({
        title: "URL del logo actualizada",
        description: "La nueva URL ha sido asignada. No olvides guardar los cambios.",
    });
  };


  const onSubmit = (data: SettingsFormData) => {
    if (!settingsRef) return;
    setIsSaving(true);
    
    setDocumentNonBlocking(settingsRef, data, { merge: true });

    toast({
      title: "Configuración Guardada",
      description: "Los datos de la empresa se han actualizado correctamente.",
    });

    setIsSaving(false);
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
            <CardTitle>Información General y Contacto</CardTitle>
            <CardDescription>
              Gestiona los datos principales, logo e información de contacto de tu empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label>Logo de la Empresa</Label>
                <div className="flex items-start gap-6">
                    <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed relative overflow-hidden">
                    {logoUrl ? (
                        <Image src={logoUrl} alt="Logo" fill className="object-contain" />
                    ) : (
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                    </div>
                    <div className="flex-1 space-y-3">
                        <FileUpload onFileSelect={handleFileChange} disabled={isUploading} />
                        <div className="flex items-center gap-2">
                          <Separator className="flex-1" />
                          <span className="text-xs text-muted-foreground">O</span>
                          <Separator className="flex-1" />
                        </div>
                        <UrlUploadDialog onSave={handleUrlSave} />

                        {isUploading && (
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Subiendo...</p>
                                <Progress value={uploadProgress} className="w-full" />
                            </div>
                        )}
                        {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
                    </div>
                </div>
            </div>

             <div className="grid md:grid-cols-2 gap-6">
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
                
                 <div className="space-y-2">
                  <Label htmlFor="companyPhone">Teléfono de Contacto</Label>
                  <Controller
                    name="companyPhone"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="companyPhone" placeholder="Ej: +58 212 555 1234" />
                    )}
                  />
                  {errors.companyPhone && <p className="text-sm text-destructive">{errors.companyPhone.message}</p>}
                </div>

                 <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email de Contacto</Label>
                  <Controller
                    name="companyEmail"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="companyEmail" type="email" placeholder="Ej: contacto@empresa.com" />
                    )}
                  />
                  {errors.companyEmail && <p className="text-sm text-destructive">{errors.companyEmail.message}</p>}
                </div>
                
                 <div className="space-y-2">
                  <Label htmlFor="companySocialMedia">Red Social (Usuario o URL)</Label>
                  <Controller
                    name="companySocialMedia"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="companySocialMedia" placeholder="Ej: @MiEmpresa" />
                    )}
                  />
                  {errors.companySocialMedia && <p className="text-sm text-destructive">{errors.companySocialMedia.message}</p>}
                </div>
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
             <Button type="submit" disabled={isSaving || isUploading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
