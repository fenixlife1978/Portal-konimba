
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection } from '@/firebase';
import { db } from '@/firebase/config';
import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
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
  CaseSensitive,
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
  country?: 'VE' | 'CO' | '';
  paymentMethod?: 'transferencia' | 'pagoMovil' | 'usdt' | '';
  bank?: string;
  accountNumber?: string;
  mobilePaymentBank?: string;
  mobilePaymentPhone?: string;
  mobilePaymentId?: string;
  usdtAddress?: string;
};

/* ---------- SubIdModal ---------- */
function SubIdModal({
  publisher,
  onSave,
  onOpenChange,
}: {
  publisher: Publisher;
  onSave: (data: { subId: string }) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [subId, setSubId] = useState(publisher.subId || '');

  const handleSaveSubId = async () => {
    await onSave({ subId });
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Asignar/Modificar SUB ID</DialogTitle>
        <DialogDescription>
          Establece el SUB ID para el publisher {publisher.firstName} {publisher.lastName}.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Label htmlFor="subIdModalInput">SUB ID</Label>
        <Input
          id="subIdModalInput"
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          placeholder="Ej: KON-123"
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSaveSubId}>Guardar SUB ID</Button>
      </DialogFooter>
    </>
  );
}


/* ---------- EditDetailsModal ---------- */
function EditDetailsModal({
  publisher,
  onSave,
  onOpenChange,
}: {
  publisher: Publisher;
  onSave: (data: Partial<Publisher>) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: publisher.firstName || '',
    lastName: publisher.lastName || '',
    phone: publisher.phone || '',
    address: publisher.address || '',
  });

  const handleSave = async () => {
    await onSave(formData);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ver / Editar Detalles del Publisher</DialogTitle>
        <DialogDescription>
          Aquí puedes ver los datos de pago (solo lectura) y modificar la información personal del publisher.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto p-1 space-y-6">
        {/* Personal Information (Editable) */}
        <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-lg">Información Personal (Editable)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData(prev => ({...prev, firstName: e.target.value}))} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData(prev => ({...prev, lastName: e.target.value}))} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" value={formData.phone} onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input id="address" value={formData.address} onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))} />
                </div>
            </div>
        </div>
        
        <Separator />

        {/* Payment Information (Read-Only) */}
        <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-lg">Información de Pago (Solo Lectura)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label>País de Residencia</Label>
                  <Input value={publisher.country || 'No especificado'} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago Principal</Label>
                  <Input value={publisher.paymentMethod || 'No especificado'} readOnly disabled />
                </div>
              </div>

              {publisher.paymentMethod === 'transferencia' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Input value={publisher.bank || ''} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Cuenta</Label>
                    <Input value={publisher.accountNumber || ''} readOnly disabled />
                  </div>
                </div>
              )}

              {publisher.paymentMethod === 'pagoMovil' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco (Pago Móvil)</Label>
                    <Input value={publisher.mobilePaymentBank || ''} readOnly disabled />
                  </div>
                   <div className="space-y-2">
                      <Label>Teléfono (Pago Móvil)</Label>
                      <Input value={publisher.mobilePaymentPhone || ''} readOnly disabled />
                   </div>
                   <div className="space-y-2">
                      <Label>Cédula/RIF (Pago Móvil)</Label>
                      <Input value={publisher.mobilePaymentId || ''} readOnly disabled />
                   </div>
                </div>
              )}
               {publisher.paymentMethod === 'usdt' && (
                  <div className="space-y-2">
                      <Label>Wallet/Email USDT (Binance)</Label>
                      <Input value={publisher.usdtAddress || ''} readOnly disabled />
                  </div>
              )}
        </div>
      </div>

      <DialogFooter className='pt-4'>
        <DialogClose asChild>
          <Button variant="outline">Cerrar</Button>
        </DialogClose>
        <Button onClick={handleSave}>Guardar Cambios Personales</Button>
      </DialogFooter>
    </>
  );
}


/* ---------- PublisherRow ---------- */
function PublisherRow({
  publisher,
  onSave,
  onDelete,
}: {
  publisher: Publisher;
  onSave: (id: string, data: Partial<Publisher>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isSubIdModalOpen, setIsSubIdModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">{publisher.subId || '-'}</TableCell>
      <TableCell>{`${publisher.firstName} ${publisher.lastName}`}</TableCell>
      <TableCell>{publisher.email}</TableCell>
      <TableCell>
        <Badge variant={publisher.status === 'active' ? 'default' : 'secondary'}>
          {publisher.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Dialog open={isSubIdModalOpen} onOpenChange={setIsSubIdModalOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <CaseSensitive className="mr-2 h-4 w-4" />
                  Asignar SUB ID
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <SubIdModal
                  publisher={publisher}
                  onSave={(data) => onSave(publisher.id, data)}
                  onOpenChange={setIsSubIdModalOpen}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
              <DialogTrigger asChild>
                 <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Ver / Editar Detalles
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                 <EditDetailsModal 
                    publisher={publisher}
                    onSave={(data) => onSave(publisher.id, data)}
                    onOpenChange={setIsDetailsModalOpen}
                 />
              </DialogContent>
            </Dialog>
            
            <DropdownMenuSeparator />

            <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
               <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Publisher
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                 <DialogHeader>
                    <DialogTitle>¿Estás seguro?</DialogTitle>
                    <DialogDescription>
                        Esta acción es irreversible y eliminará permanentemente al publisher y todos sus datos asociados.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button variant="destructive" onClick={() => onDelete(publisher.id)}>Sí, eliminar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ---------- PublishersPage (Main Component) ---------- */
export default function PublishersPage() {
  const firestore = db;
  const { toast } = useToast();

  const publishersCollectionRef = useMemo(
    () => (firestore ? collection(firestore, 'publishers') : null),
    [firestore]
  );
  const { data: publishers, isLoading } = useCollection<Publisher>(
    publishersCollectionRef
  );
  
  const [filter, setFilter] = useState('');

  const filteredPublishers = useMemo(() => {
    if (!publishers) return [];
    return publishers.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(filter.toLowerCase()) ||
        p.email.toLowerCase().includes(filter.toLowerCase()) ||
        p.subId?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [publishers, filter]);


  const handleSave = async (id: string, data: Partial<Publisher>) => {
    if (!firestore) return;
    try {
      const publisherRef = doc(firestore, 'publishers', id);
      await updateDoc(publisherRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Publisher actualizado' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'publishers', id));
      toast({ title: 'Publisher eliminado' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: error.message,
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Gestión de Publishers
        </h1>
        <Button asChild variant="outline">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>
      
      <div className="mb-4">
        <Input 
          placeholder="Buscar por nombre, email o SUB ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SUB ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Cargando publishers...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredPublishers.length === 0 && (
                 <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No se encontraron publishers.
                  </TableCell>
                </TableRow>
              )}
              {filteredPublishers.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    