'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useUser } from '@/firebase';
import { db, auth } from '@/firebase/config';
import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithCredential, EmailAuthProvider } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

type Publisher = {
  id: string;
  subId?: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  paymentMethod?: 'transferencia' | 'pagoMovil' | 'usdt' | '';
  bank?: string;
  accountNumber?: string;
  mobilePaymentBank?: string;
  mobilePaymentPhone?: string;
  mobilePaymentId?: string;
  usdtAddress?: string;
};

const createPublisherSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email("Debe ser un email válido."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
    phone: z.string().optional(),
    country: z.string().optional(),
    subId: z.string().optional(),
});
type CreatePublisherFormData = z.infer<typeof createPublisherSchema>;

function CreatePublisherModal({ onSave, onOpenChange }: { onSave: (data: CreatePublisherFormData) => Promise<void>; onOpenChange: (open: boolean) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<CreatePublisherFormData>({
        resolver: zodResolver(createPublisherSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            phone: '',
            country: '',
            subId: ''
        }
    });

    const handleFormSubmit = async (data: CreatePublisherFormData) => {
        await onSave(data);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <DialogHeader>
                <DialogTitle>Crear Nuevo Publisher</DialogTitle>
                <DialogDescription>
                Completa los datos para registrar un nuevo publisher. Se creará una cuenta de autenticación para ellos.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">Nombre</Label>
                        <Input id="firstName" {...register('firstName')} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName">Apellido</Label>
                        <Input id="lastName" {...register('lastName')} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Contraseña Inicial *</Label>
                    <Input id="password" type="password" {...register('password')} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input id="phone" {...register('phone')} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="country">País</Label>
                        <Input id="country" {...register('country')} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="subId">Sub ID</Label>
                    <Input id="subId" {...register('subId')} />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
                <Button type="submit">Crear Publisher</Button>
            </DialogFooter>
        </form>
    );
}


/* ---------- EditDetailsModal ---------- */
interface EditDetailsModalProps {
  publisher: Publisher;
  onSave: (data: Partial<Publisher>) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

function EditDetailsModal({ publisher, onSave, onOpenChange }: EditDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Publisher>>({});

  useState(() => {
    setFormData({
        firstName: publisher.firstName || '',
        lastName: publisher.lastName || '',
        phone: publisher.phone || '',
        address: publisher.address || '',
        country: publisher.country || '',
        subId: publisher.subId || '',
        paymentMethod: publisher.paymentMethod || '',
        bank: publisher.bank || '',
        accountNumber: publisher.accountNumber || '',
        mobilePaymentBank: publisher.mobilePaymentBank || '',
        mobilePaymentPhone: publisher.mobilePaymentPhone || '',
        mobilePaymentId: publisher.mobilePaymentId || '',
        usdtAddress: publisher.usdtAddress || '',
    });
  });


  const handleSave = async () => {
    await onSave(formData);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar Detalles del Publisher</DialogTitle>
        <DialogDescription>
          Modifica la información del publisher {publisher.firstName} {publisher.lastName}.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
        <h3 className="font-bold">Información Personal</h3>
        <div>
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            value={formData.firstName || ''}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            value={formData.lastName || ''}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
        <div>
            <Label htmlFor="subId">Sub ID</Label>
            <Input id="subId" value={formData.subId || ''} onChange={(e) => setFormData({ ...formData, subId: e.target.value })} />
        </div>

        <Separator className='my-4' />
        <h3 className="font-bold">Información de Pago</h3>
        <div>
          <Label htmlFor="country">País</Label>
          <Input
            id="country"
            value={formData.country || ''}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          />
        </div>
         <div>
          <Label htmlFor="paymentMethod">Método de Pago</Label>
          <Input
            id="paymentMethod"
            value={formData.paymentMethod || ''}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
          />
        </div>
         <div>
          <Label htmlFor="bank">Banco (Transferencia)</Label>
          <Input
            id="bank"
            value={formData.bank || ''}
            onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
          />
        </div>
         <div>
          <Label htmlFor="accountNumber">Nº de Cuenta (Transferencia)</Label>
          <Input
            id="accountNumber"
            value={formData.accountNumber || ''}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="mobilePaymentBank">Banco (Pago Móvil)</Label>
          <Input
            id="mobilePaymentBank"
            value={formData.mobilePaymentBank || ''}
            onChange={(e) => setFormData({ ...formData, mobilePaymentBank: e.target.value })}
          />
        </div>
         <div>
          <Label htmlFor="mobilePaymentPhone">Teléfono (Pago Móvil)</Label>
          <Input
            id="mobilePaymentPhone"
            value={formData.mobilePaymentPhone || ''}
            onChange={(e) => setFormData({ ...formData, mobilePaymentPhone: e.target.value })}
          />
        </div>
         <div>
          <Label htmlFor="mobilePaymentId">Cédula/RIF (Pago Móvil)</Label>
          <Input
            id="mobilePaymentId"
            value={formData.mobilePaymentId || ''}
            onChange={(e) => setFormData({ ...formData, mobilePaymentId: e.target.value })}
          />
        </div>
         <div>
          <Label htmlFor="usdtAddress">Email (USDT)</Label>
          <Input
            id="usdtAddress"
            value={formData.usdtAddress || ''}
            onChange={(e) => setFormData({ ...formData, usdtAddress: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSave}>Guardar Cambios</Button>
      </DialogFooter>
    </>
  );
}

function PublisherRow({ publisher, onSave, onDelete }: { publisher: Publisher; onSave: (id: string, data: Partial<Publisher>) => Promise<void>; onDelete: (id: string) => Promise<void>; }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <TableRow>
      <TableCell>{publisher.firstName} {publisher.lastName}</TableCell>
      <TableCell>{publisher.email}</TableCell>
      <TableCell>{publisher.subId}</TableCell>
      <TableCell><Badge variant={publisher.status === 'active' ? 'default' : 'secondary'}>{publisher.status}</Badge></TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
             <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Pencil className="mr-2 h-4 w-4" />Ver / Editar Detalles</DropdownMenuItem></DialogTrigger>
                <DialogContent className="sm:max-w-[625px]"><EditDetailsModal publisher={publisher} onSave={(data) => onSave(publisher.id, data)} onOpenChange={setIsEditing} /></DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
            <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
              <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar Publisher</DropdownMenuItem></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>¿Estás seguro?</DialogTitle><DialogDescription>Esta acción eliminará al publisher permanentemente y no se podrá deshacer.</DialogDescription></DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button variant="destructive" onClick={async () => { await onDelete(publisher.id); setIsDeleting(false); }}>Sí, eliminar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function PublishersPage() {
  const firestore = db;
  const { user } = useUser();
  const { toast } = useToast();
  const [filter, setFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const publishersCollectionRef = useMemo(() => (firestore && user ? collection(firestore, 'publishers') : null), [firestore, user]);
  const { data: publishers, isLoading } = useCollection<Publisher>(publishersCollectionRef);

  const handleCreatePublisher = async (data: CreatePublisherFormData) => {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "El administrador no está autenticado." });
      return;
    }
    
    const currentAdmin = auth.currentUser;
    if (!currentAdmin?.email) {
       toast({ variant: "destructive", title: "Error de Sesión", description: "No se pudo verificar la sesión del administrador." });
       return;
    }

    const { email, password, ...profileData } = data;

    try {
        const { user: newPublisherUser } = await createUserWithEmailAndPassword(auth, email, password);

        const publisherRef = doc(firestore, 'publishers', newPublisherUser.uid);
        await setDoc(publisherRef, {
            id: newPublisherUser.uid,
            email,
            ...profileData,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Publisher Creado", description: "El nuevo publisher ha sido registrado exitosamente." });
        
        setIsCreateModalOpen(false);

    } catch (error: any) {
        let description = "Ocurrió un error desconocido.";
        if (error.code === 'auth/email-already-in-use') {
            description = "El correo electrónico ya está registrado. Por favor, utiliza otro.";
        } else if (error.code === 'auth/weak-password') {
            description = "La contraseña es demasiado débil (mínimo 6 caracteres).";
        }
        toast({ variant: "destructive", title: "Error al crear publisher", description });
    } finally {
        if (auth.currentUser?.uid !== currentAdmin.uid) {
            // The session has changed to the new user. Sign them out
            // and then force the admin to log back in. This is the safest approach.
            await auth.signOut();
            // The redirection or session handling will be managed by the application's auth listeners.
        }
    }
  };


  const handleUpdatePublisher = async (id: string, data: Partial<Publisher>) => {
    if (!firestore) return;
    try {
      const publisherRef = doc(firestore, 'publishers', id);
      await updateDoc(publisherRef, { ...data, updatedAt: serverTimestamp() });
      toast({ title: "Publisher actualizado" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDeletePublisher = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'publishers', id));
      toast({ title: "Publisher eliminado", description: "El documento del publisher fue eliminado. La cuenta de Auth sigue activa."});
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message });
    }
  };
  
  const filteredPublishers = useMemo(() => {
    if (!publishers) return [];
    return publishers.filter(p =>
      p.firstName?.toLowerCase().includes(filter.toLowerCase()) ||
      p.lastName?.toLowerCase().includes(filter.toLowerCase()) ||
      p.email?.toLowerCase().includes(filter.toLowerCase()) ||
      p.subId?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [publishers, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Publishers</h1>
            <p className="text-muted-foreground">Crea, modifica y gestiona los perfiles de los publishers.</p>
        </div>
        <div className="flex gap-2">
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                    <Button><UserPlus className="mr-2 h-4 w-4" />Crear Publisher</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                    <CreatePublisherModal onSave={handleCreatePublisher} onOpenChange={setIsCreateModalOpen} />
                </DialogContent>
            </Dialog>
            <Button asChild variant="outline">
            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
            </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
           <div className="mb-4">
              <Input
                placeholder="Buscar por nombre, email o Sub ID..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Sub ID</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando publishers...</TableCell></TableRow>}
              {!isLoading && filteredPublishers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No se encontraron publishers.</TableCell></TableRow>}
              {filteredPublishers.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  onSave={handleUpdatePublisher}
                  onDelete={handleDeletePublisher}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
