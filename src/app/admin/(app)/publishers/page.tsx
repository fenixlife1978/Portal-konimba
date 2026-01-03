
'use client';

import { useState, useEffect, useMemo } from 'react';
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
  subId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string; // ✅ ahora string libre
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
  const [subId, setSubId] = useState('');

  // ✅ sincroniza solo cuando cambia el publisher
  useEffect(() => {
    setSubId(publisher.subId ?? '');
  }, [publisher]);

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
interface EditDetailsModalProps {
  publisher: Publisher;
  onSave: (data: Partial<Publisher>) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

function EditDetailsModal({ publisher, onSave, onOpenChange }: EditDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Publisher>>({});

  useEffect(() => {
    const mobilePaymentPhoneCode = publisher.mobilePaymentPhone?.substring(0,4) || '';
    const mobilePaymentPhoneNumber = publisher.mobilePaymentPhone?.substring(4) || '';
    const mobilePaymentIdPrefix = publisher.mobilePaymentId?.charAt(0) || '';
    const mobilePaymentIdNumber = publisher.mobilePaymentId?.substring(1) || '';

    setFormData({
        firstName: publisher.firstName || '',
        lastName: publisher.lastName || '',
        phone: publisher.phone || '',
        address: publisher.address || '',
        country: publisher.country || '',
        paymentMethod: publisher.paymentMethod || '',
        bank: publisher.bank || '',
        accountNumber: publisher.accountNumber || '',
        mobilePaymentBank: publisher.mobilePaymentBank || '',
        mobilePaymentPhone: `${mobilePaymentPhoneCode}${mobilePaymentPhoneNumber}`,
        mobilePaymentId: `${mobilePaymentIdPrefix}${mobilePaymentIdNumber}`,
        usdtAddress: publisher.usdtAddress || '',
    });
  }, [publisher]);


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

function PublisherRow({ publisher, onSave, onDelete, onUpdateSubId }: { publisher: Publisher; onSave: (data: Partial<Publisher>) => void; onDelete: () => void; onUpdateSubId: (data: { subId: string }) => void; }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSubId, setIsEditingSubId] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">{publisher.subId || <span className="text-muted-foreground">N/A</span>}</TableCell>
      <TableCell>{publisher.firstName} {publisher.lastName}</TableCell>
      <TableCell>{publisher.email}</TableCell>
      <TableCell><Badge variant={publisher.status === 'active' ? 'default' : 'secondary'}>{publisher.status}</Badge></TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Dialog open={isEditingSubId} onOpenChange={setIsEditingSubId}>
              <DialogTrigger asChild><DropdownMenuItem onSelect={e => e.preventDefault()}>Asignar SUB ID</DropdownMenuItem></DialogTrigger>
              <DialogContent><SubIdModal publisher={publisher} onSave={onUpdateSubId} onOpenChange={setIsEditingSubId} /></DialogContent>
            </Dialog>
             <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Pencil className="mr-2 h-4 w-4" />Ver / Editar Detalles</DropdownMenuItem></DialogTrigger>
                <DialogContent className="sm:max-w-[625px]"><EditDetailsModal publisher={publisher} onSave={onSave} onOpenChange={setIsEditing} /></DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
            <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
              <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar Publisher</DropdownMenuItem></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>¿Estás seguro?</DialogTitle><DialogDescription>Esta acción eliminará al publisher permanentemente y no se podrá deshacer.</DialogDescription></DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button variant="destructive" onClick={async () => { await onDelete(); setIsDeleting(false); }}>Sí, eliminar</Button>
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
  const { toast } = useToast();
  const [filter, setFilter] = useState('');

  const publishersCollectionRef = useMemo(() => firestore ? collection(firestore, 'publishers') : null, [firestore]);
  const { data: publishers, isLoading } = useCollection<Publisher>(publishersCollectionRef);

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
      toast({ title: "Publisher eliminado" });
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
        <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Publishers</h1>
        <Button asChild variant="outline">
          <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
           <div className="mb-4">
              <Input
                placeholder="Buscar por nombre, email o SUB ID..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
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
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Cargando publishers...</TableCell></TableRow>}
              {!isLoading && filteredPublishers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No se encontraron publishers.</TableCell></TableRow>}
              {filteredPublishers.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  onSave={(data) => handleUpdatePublisher(publisher.id, data)}
                  onDelete={() => handleDeletePublisher(publisher.id)}
                  onUpdateSubId={(data) => handleUpdatePublisher(publisher.id, data)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    