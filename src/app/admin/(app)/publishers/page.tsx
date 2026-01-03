
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
  Loader2
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import banksVe from '@/lib/banks-ve.json';
import banksCo from '@/lib/banks-co.json';

const phoneCodes = ["0412", "0414", "0416", "0424", "0426"];
const idPrefixes = ["V", "E", "J", "G", "P"];

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
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if the publisher prop changes
  useEffect(() => {
    setSubId(publisher.subId || '');
  }, [publisher]);

  const handleSaveSubId = async () => {
    setIsSaving(true);
    try {
        await onSave({ subId });
        onOpenChange(false);
    } finally {
        setIsSaving(false);
    }
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
        <Button onClick={handleSaveSubId} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar SUB ID
        </Button>
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
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
        mobilePaymentPhone: publisher.mobilePaymentPhone || '',
        mobilePaymentId: publisher.mobilePaymentId || '',
        usdtAddress: publisher.usdtAddress || '',
    });
  }, [publisher]);

  const handleInputChange = (field: keyof Publisher, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await onSave(formData);
        onOpenChange(false);
    } finally {
        setIsSaving(false);
    }
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
        <h4 className="font-semibold text-foreground">Información Personal</h4>
        <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" value={formData.firstName || ''} onChange={(e) => handleInputChange('firstName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" value={formData.lastName || ''} onChange={(e) => handleInputChange('lastName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={formData.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" value={formData.address || ''} onChange={(e) => handleInputChange('address', e.target.value)} />
            </div>
        </div>

        <Separator className="my-6" />

        <h4 className="font-semibold text-foreground">Información Financiera</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="country">País</Label>
            <Select onValueChange={(val: 'VE' | 'CO' | '') => handleInputChange('country', val)} value={formData.country}>
              <SelectTrigger id="country"><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VE">Venezuela</SelectItem>
                <SelectItem value="CO">Colombia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="paymentMethod">Método de Pago</Label>
            <Select onValueChange={(val) => handleInputChange('paymentMethod', val)} value={formData.paymentMethod} disabled={!formData.country}>
              <SelectTrigger id="paymentMethod"><SelectValue placeholder="Seleccionar método" /></SelectTrigger>
              <SelectContent>
                {formData.country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                {(formData.country === 'VE' || formData.country === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                <SelectItem value="usdt">USDT (Binance)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {formData.paymentMethod === 'transferencia' && (
          <div className="space-y-4 pt-4">
            <h5 className="font-medium">Detalles de Transferencia</h5>
             <div>
                <Label htmlFor="bank">Banco</Label>
                <Select onValueChange={(val) => handleInputChange('bank', val)} value={formData.bank}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                    <SelectContent>
                        {formData.country === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        {formData.country === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="accountNumber">Número de Cuenta</Label>
                <Input id="accountNumber" value={formData.accountNumber || ''} onChange={(e) => handleInputChange('accountNumber', e.target.value)} />
            </div>
          </div>
        )}
        
        {formData.paymentMethod === 'pagoMovil' && formData.country === 'VE' && (
          <div className="space-y-4 pt-4">
            <h5 className="font-medium">Detalles de Pago Móvil</h5>
             <div>
                <Label htmlFor="mobilePaymentBank">Banco</Label>
                 <Select onValueChange={(val) => handleInputChange('mobilePaymentBank', val)} value={formData.mobilePaymentBank}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                    <SelectContent>
                        {banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="mobilePaymentPhone">Teléfono</Label>
                <Input id="mobilePaymentPhone" value={formData.mobilePaymentPhone || ''} onChange={(e) => handleInputChange('mobilePaymentPhone', e.target.value)} />
            </div>
             <div>
                <Label htmlFor="mobilePaymentId">Cédula / RIF</Label>
                <Input id="mobilePaymentId" value={formData.mobilePaymentId || ''} onChange={(e) => handleInputChange('mobilePaymentId', e.target.value)} />
            </div>
          </div>
        )}

        {formData.paymentMethod === 'usdt' && (
          <div className="space-y-4 pt-4">
            <h5 className="font-medium">Detalles de USDT</h5>
            <div>
              <Label>Plataforma</Label>
              <Input value="Binance" readOnly />
            </div>
            <div>
              <Label htmlFor="usdtAddress">Email de Binance</Label>
              <Input id="usdtAddress" value={formData.usdtAddress || ''} onChange={(e) => handleInputChange('usdtAddress', e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
        </Button>
      </DialogFooter>
    </>
  );
}


/* ---------- PublisherRow ---------- */
function PublisherRow({ publisher, onUpdate, onDelete }: { publisher: Publisher; onUpdate: (id: string, data: Partial<Publisher>) => void; onDelete: (id: string) => void }) {
  const [isSubIdModalOpen, setIsSubIdModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleSaveSubId = async (data: { subId: string }) => {
    await onUpdate(publisher.id, data);
  };
  
  const handleSaveDetails = async (data: Partial<Publisher>) => {
    await onUpdate(publisher.id, data);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{publisher.subId || 'N/A'}</TableCell>
      <TableCell>{publisher.firstName}</TableCell>
      <TableCell>{publisher.lastName}</TableCell>
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
                  Asignar SUB ID
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <SubIdModal publisher={publisher} onSave={handleSaveSubId} onOpenChange={setIsSubIdModalOpen} />
              </DialogContent>
            </Dialog>

            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Ver / Editar Detalles
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                    <EditDetailsModal publisher={publisher} onSave={handleSaveDetails} onOpenChange={setIsDetailsModalOpen} />
                </DialogContent>
            </Dialog>

            <DropdownMenuSeparator />

            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Publisher
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Estás seguro?</DialogTitle>
                        <DialogDescription>Esta acción eliminará al publisher permanentemente. Esta acción no se puede deshacer.</DialogDescription>
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

export default function PublishersPage() {
  const firestore = db;
  const { toast } = useToast();
  const [filter, setFilter] = useState('');

  const publishersCollectionRef = useMemo(() => firestore ? collection(firestore, 'publishers') : null, [firestore]);
  const { data: publishers, isLoading } = useCollection<Publisher>(publishersCollectionRef);

  const handleUpdatePublisher = async (id: string, data: Partial<Publisher>) => {
    if (!firestore) return;
    const publisherRef = doc(firestore, 'publishers', id);
    try {
      await updateDoc(publisherRef, { ...data, updatedAt: serverTimestamp() });
      toast({ title: 'Publisher actualizado', description: 'Los datos del publisher se han guardado.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message });
    }
  };

  const handleDeletePublisher = async (id: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'publishers', id));
        toast({ title: "Publisher Eliminado" });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error al eliminar", description: error.message });
    }
  };

  const filteredPublishers = useMemo(() => {
    if (!publishers) return [];
    return publishers.filter(p =>
      p.firstName.toLowerCase().includes(filter.toLowerCase()) ||
      p.lastName.toLowerCase().includes(filter.toLowerCase()) ||
      p.email.toLowerCase().includes(filter.toLowerCase()) ||
      (p.subId && p.subId.toLowerCase().includes(filter.toLowerCase()))
    );
  }, [publishers, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Publishers</h1>
        <div className="flex gap-2 items-center">
             <Input 
                placeholder="Filtrar por nombre, email, SUB ID..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full max-w-sm"
             />
            <Button asChild variant="outline">
                <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al panel
                </Link>
            </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SUB ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Cargando publishers...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredPublishers.length === 0 && (
                 <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No se encontraron publishers.
                  </TableCell>
                </TableRow>
              )}
              {filteredPublishers.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  onUpdate={handleUpdatePublisher}
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

    