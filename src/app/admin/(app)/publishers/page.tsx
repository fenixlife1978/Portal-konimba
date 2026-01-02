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
  Edit
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
  mobilePaymentPhoneCode?: string;
  mobilePaymentPhoneNumber?: string;
  mobilePaymentIdPrefix?: string;
  mobilePaymentIdNumber?: string;
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
interface EditDetailsModalProps {
  publisher: Publisher;
  onSave: (data: Partial<Publisher>) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

function EditDetailsModal({ publisher, onSave, onOpenChange }: EditDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Publisher>>({
    firstName: publisher.firstName || '',
    lastName: publisher.lastName || '',
    phone: publisher.phone || '',
    address: publisher.address || '',
    country: publisher.country || '',
    paymentMethod: publisher.paymentMethod || '',
    bank: publisher.bank || '',
    accountNumber: publisher.accountNumber || '',
    mobilePaymentBank: publisher.mobilePaymentBank || '',
    mobilePaymentPhoneCode: '',
    mobilePaymentPhoneNumber: '',
    mobilePaymentIdPrefix: '',
    mobilePaymentIdNumber: '',
    usdtAddress: publisher.usdtAddress || '',
  });

   useEffect(() => {
    if (publisher.mobilePaymentPhone) {
        const phoneString = String(publisher.mobilePaymentPhone);
        const code = phoneString.substring(0, 4);
        if (phoneCodes.includes(code)) {
            setFormData(prev => ({
                ...prev,
                mobilePaymentPhoneCode: code,
                mobilePaymentPhoneNumber: phoneString.substring(4)
            }));
        }
    }
    if (publisher.mobilePaymentId) {
        const idString = String(publisher.mobilePaymentId);
        const prefix = idString.charAt(0).toUpperCase();
        if (idPrefixes.includes(prefix)) {
             setFormData(prev => ({
                ...prev,
                mobilePaymentIdPrefix: prefix,
                mobilePaymentIdNumber: idString.substring(1)
            }));
        }
    }
  }, [publisher]);

  const handleSave = async () => {
    const dataToSave = { ...formData };
    if (formData.paymentMethod === 'pagoMovil') {
        dataToSave.mobilePaymentPhone = `${formData.mobilePaymentPhoneCode}${formData.mobilePaymentPhoneNumber}`;
        dataToSave.mobilePaymentId = `${formData.mobilePaymentIdPrefix}${formData.mobilePaymentIdNumber}`;
    }
    await onSave(dataToSave);
    onOpenChange(false);
  };
  
  const handleCountryChange = (value: 'VE' | 'CO' | '') => {
      setFormData(prev => ({
        ...prev,
        country: value,
        paymentMethod: '', bank: '', accountNumber: '',
        mobilePaymentBank: '', mobilePaymentPhoneCode: '', mobilePaymentPhoneNumber: '',
        mobilePaymentIdPrefix: '', mobilePaymentIdNumber: '', usdtAddress: ''
      }));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ver / Editar Detalles del Publisher</DialogTitle>
        <DialogDescription>
          Modifica la información personal y de pago del publisher {publisher.firstName} {publisher.lastName}.
        </DialogDescription>
      </DialogHeader>
       <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
        <h3 className="text-lg font-semibold border-b pb-2">Información Personal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
            <Label htmlFor="firstName">Nombre</Label>
            <Input id="firstName" value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            </div>
            <div>
            <Label htmlFor="lastName">Apellido</Label>
            <Input id="lastName" value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            </div>
            <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div>
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
        </div>
        
        <Separator className="my-4" />

        <h3 className="text-lg font-semibold border-b pb-2">Información de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="country">País de Residencia</Label>
                <Select onValueChange={(val: 'VE' | 'CO' | '') => handleCountryChange(val)} value={formData.country}>
                    <SelectTrigger id="country"><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="VE">Venezuela</SelectItem>
                        <SelectItem value="CO">Colombia</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select onValueChange={(val) => setFormData(prev => ({ ...prev, paymentMethod: val as any }))} value={formData.paymentMethod} disabled={!formData.country}>
                    <SelectTrigger id="paymentMethod"><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                    <SelectContent>
                        {formData.country === 'VE' && <SelectItem value="pagoMovil">Pago Móvil</SelectItem>}
                        {(formData.country === 'VE' || formData.country === 'CO') && <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>}
                        <SelectItem value="usdt">USDT (Binance)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        {formData.paymentMethod === 'transferencia' && (
          <div className='space-y-4 animate-in fade-in-0 duration-300'>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank">Banco</Label>
                <Select onValueChange={(val) => setFormData(prev => ({...prev, bank: val}))} value={formData.bank}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                    <SelectContent>
                        {formData.country === 'VE' && banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        {formData.country === 'CO' && banksCo.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Número de Cuenta</Label>
                <Input id="accountNumber" value={formData.accountNumber || ''} onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))} placeholder={formData.country === 'VE' ? '20 dígitos' : 'Número de cuenta'} />
              </div>
            </div>
          </div>
        )}

        {formData.paymentMethod === 'pagoMovil' && formData.country === 'VE' && (
            <div className='space-y-4 animate-in fade-in-0 duration-300'>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Banco</Label>
                        <Select onValueChange={(val) => setFormData(prev => ({ ...prev, mobilePaymentBank: val }))} value={formData.mobilePaymentBank}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                            <SelectContent>{banksVe.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Número de Teléfono</Label>
                        <div className="flex gap-2">
                            <Select onValueChange={(val) => setFormData(prev => ({ ...prev, mobilePaymentPhoneCode: val }))} value={formData.mobilePaymentPhoneCode}>
                                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Código"/></SelectTrigger>
                                <SelectContent>{phoneCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input value={formData.mobilePaymentPhoneNumber || ''} onChange={(e) => setFormData(prev => ({ ...prev, mobilePaymentPhoneNumber: e.target.value }))} placeholder="XXXXXXX" maxLength={7} />
                        </div>
                    </div>
                    <div className="space-y-2 col-span-1 md:col-span-2">
                        <Label>Cédula o RIF</Label>
                        <div className="flex gap-2">
                            <Select onValueChange={(val) => setFormData(prev => ({ ...prev, mobilePaymentIdPrefix: val }))} value={formData.mobilePaymentIdPrefix}>
                                <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tipo"/></SelectTrigger>
                                <SelectContent>{idPrefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input value={formData.mobilePaymentIdNumber || ''} onChange={(e) => setFormData(prev => ({ ...prev, mobilePaymentIdNumber: e.target.value }))} placeholder="12345678" />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {formData.paymentMethod === 'usdt' && (
            <div className='space-y-4 animate-in fade-in-0 duration-300'>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Plataforma</Label>
                        <Input value="Binance" readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                        <Label>Correo electrónico de Binance</Label>
                        <Input type="email" value={formData.usdtAddress || ''} onChange={(e) => setFormData(prev => ({ ...prev, usdtAddress: e.target.value }))} placeholder="tu.correo@email.com" />
                    </div>
                </div>
            </div>
        )}

      </div>
      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSave}>Guardar Cambios</Button>
      </DialogFooter>
    </>
  );
}

/* ---------- PublisherRow Component ---------- */
function PublisherRow({
  publisher,
  onUpdate,
  onDelete,
}: {
  publisher: Publisher;
  onUpdate: (id: string, data: Partial<Publisher>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isSubIdModalOpen, setIsSubIdModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const handleSaveSubId = async (data: { subId: string }) => {
    await onUpdate(publisher.id, data);
  };
  
  const handleSaveDetails = async (data: Partial<Publisher>) => {
    await onUpdate(publisher.id, data);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{publisher.subId || <Badge variant="secondary">Sin Asignar</Badge>}</TableCell>
      <TableCell>{publisher.firstName} {publisher.lastName}</TableCell>
      <TableCell>{publisher.email}</TableCell>
      <TableCell><Badge variant={publisher.status === 'active' ? 'default' : 'destructive'}>{publisher.status}</Badge></TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Dialog open={isSubIdModalOpen} onOpenChange={setIsSubIdModalOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="mr-2 h-4 w-4" /> Asignar SUB ID
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent><SubIdModal publisher={publisher} onSave={handleSaveSubId} onOpenChange={setIsSubIdModalOpen} /></DialogContent>
            </Dialog>

            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Edit className="mr-2 h-4 w-4" /> Ver / Editar Detalles
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="max-w-3xl"><EditDetailsModal publisher={publisher} onSave={handleSaveDetails} onOpenChange={setIsDetailsModalOpen} /></DialogContent>
            </Dialog>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(publisher.id)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar Publisher
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ---------- Main Page Component ---------- */
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
      toast({ title: "Publisher actualizado", description: "Los datos del publisher se han guardado." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al actualizar", description: error.message });
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
    if (!filter) return publishers;
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
        <Button asChild variant="outline"><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link></Button>
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
