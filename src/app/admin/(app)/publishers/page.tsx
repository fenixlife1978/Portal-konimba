'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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
import { MoreHorizontal, Pencil, Trash2, ArrowLeft, CaseSensitive, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import banksVe from '@/lib/banks-ve.json';
import banksCo from '@/lib/banks-co.json';

const phoneCodes = ["0412", "0414", "0416", "0424", "0426"];
const idPrefixes = ["V", "E", "J", "G", "P"];

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
  mobilePaymentPhoneCode?: string;
  mobilePaymentPhoneNumber?: string;
  mobilePaymentIdPrefix?: string;
  mobilePaymentIdNumber?: string;
  usdtAddress?: string;
};

// Modal exclusivo para el SUB ID
function SubIdModal({ publisher, onSave, onOpenChange }: { publisher: Publisher; onSave: (data: { subId: string }) => Promise<void>; onOpenChange: (open: boolean) => void }) {
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


function PublisherRow({ publisher, onSave, onDelete }: { publisher: Publisher; onSave: (data: Partial<Publisher>) => Promise<void>; onDelete: () => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubIdModalOpen, setIsSubIdModalOpen] = useState(false);
  const [editedPublisher, setEditedPublisher] = useState<Publisher>(publisher);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setEditedPublisher(prev => ({ ...prev, [id]: value }));
  };
  
  const handleSelectChange = (field: keyof Publisher, value: string) => {
    setEditedPublisher(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    await onSave(editedPublisher);
    setIsEditing(false);
  };
  
  const handleSaveSubIdWrapper = async (data: { subId: string }) => {
    await onSave(data);
  };

  const handleDeleteConfirm = async () => {
    await onDelete();
    setIsDeleting(false);
  }

  return (
    <TableRow key={publisher.id}>
      <TableCell className="font-medium">{publisher.firstName}</TableCell>
      <TableCell>{publisher.lastName}</TableCell>
      <TableCell>{publisher.email}</TableCell>
      <TableCell>{publisher.subId || 'N/A'}</TableCell>
      <TableCell>
        <Badge variant={publisher.status === 'active' ? 'default' : 'secondary'}>
          {publisher.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditedPublisher(publisher); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Ver / Editar Detalles
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Detalles del Publisher</DialogTitle>
                  <DialogDescription>
                    Ver y editar la información básica. La información de pago es de solo lectura.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
                  
                  <h3 className="font-semibold text-foreground text-lg">Información Personal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input id="firstName" value={editedPublisher.firstName} onChange={handleInputChange} />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input id="lastName" value={editedPublisher.lastName} onChange={handleInputChange} />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input id="phone" value={editedPublisher.phone || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Input id="address" value={editedPublisher.address || ''} onChange={handleInputChange} />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <h3 className="font-semibold text-foreground text-lg">Información de Pago (Solo Lectura)</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
                        <div className="space-y-2">
                            <Label htmlFor="country">País de Residencia</Label>
                            <Input id="country" value={publisher.country || 'No especificado'} readOnly disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="paymentMethod">Método de Pago Principal</Label>
                            <Input id="paymentMethod" value={publisher.paymentMethod || 'No especificado'} readOnly disabled />
                        </div>
                    </div>

                    {publisher.paymentMethod === 'transferencia' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="bank">Banco</Label>
                                <Input id="bank" value={publisher.bank || ''} readOnly disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountNumber">Número de Cuenta</Label>
                                <Input id="accountNumber" value={publisher.accountNumber || ''} readOnly disabled />
                            </div>
                        </div>
                    )}

                    {publisher.paymentMethod === 'pagoMovil' && publisher.country === 'VE' && (
                        <>
                         <div className="space-y-2">
                            <Label htmlFor="mobilePaymentBank">Banco (Pago Móvil)</Label>
                            <Input id="mobilePaymentBank" value={publisher.mobilePaymentBank || ''} readOnly disabled />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Teléfono (Pago Móvil)</Label>
                                <Input value={`${publisher.mobilePaymentPhoneCode || ''}${publisher.mobilePaymentPhoneNumber || ''}`} readOnly disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Cédula o RIF (Pago Móvil)</Label>
                                 <Input value={`${publisher.mobilePaymentIdPrefix || ''}${publisher.mobilePaymentIdNumber || ''}`} readOnly disabled />
                            </div>
                         </div>
                        </>
                    )}
                    
                    {publisher.paymentMethod === 'usdt' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Plataforma</Label>
                                <Input value="Binance" readOnly disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="usdtAddress">Correo electrónico de Binance</Label>
                                <Input id="usdtAddress" type="email" value={publisher.usdtAddress || ''} readOnly disabled />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleSave}>Guardar Cambios</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
            <Dialog open={isSubIdModalOpen} onOpenChange={setIsSubIdModalOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <CaseSensitive className="mr-2 h-4 w-4" />
                  Asignar SUB ID
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <SubIdModal publisher={publisher} onSave={handleSaveSubIdWrapper} onOpenChange={setIsSubIdModalOpen} />
              </DialogContent>
            </Dialog>
            <DropdownMenuSeparator />
            <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
               <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Estás seguro?</DialogTitle>
                  <DialogDescription>
                    Esta acción eliminará permanentemente los datos del publisher de la base de datos, pero no su cuenta de autenticación. Esta operación no se puede deshacer.
                  </DialogDescription>
                </DialogHeader>
                 <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button variant="destructive" onClick={handleDeleteConfirm}>Sí, eliminar</Button>
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

  const publishersCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'publishers');
  }, [firestore]);

  const { data: publishers, isLoading } = useCollection<Publisher>(publishersCollectionRef);

  const handleSavePublisher = async (id: string, data: Partial<Publisher>) => {
    if (!firestore) return;
    const publisherRef = doc(firestore, 'publishers', id);
    
    // Prepare data for saving - ensure we only send what's allowed
    const { 
      firstName, lastName, phone, address, subId, status
    } = data;
    
    const dataToSave: Partial<Publisher & { updatedAt: any }> = {
        updatedAt: serverTimestamp()
    };

    if (firstName !== undefined) dataToSave.firstName = firstName;
    if (lastName !== undefined) dataToSave.lastName = lastName;
    if (phone !== undefined) dataToSave.phone = phone;
    if (address !== undefined) dataToSave.address = address;
    if (subId !== undefined) dataToSave.subId = subId;
    if (status !== undefined) dataToSave.status = status;


    try {
      await updateDoc(publisherRef, dataToSave as any, { merge: true });
      toast({
        title: "Publisher actualizado",
        description: "Los datos del publisher se han guardado.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: error.message || "No se pudo guardar los cambios.",
      });
    }
  };

  const handleDeletePublisher = async (id: string) => {
    if (!firestore) return;
    const publisherRef = doc(firestore, 'publishers', id);
    try {
      await deleteDoc(publisherRef);
      toast({
        title: "Publisher eliminado",
        description: "Los datos del publisher han sido eliminados del sistema.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el publisher.",
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

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>SUB ID</TableHead>
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
              {!isLoading && publishers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No se encontraron publishers.
                  </TableCell>
                </TableRow>
              )}
              {publishers?.map((publisher) => (
                <PublisherRow
                  key={publisher.id}
                  publisher={publisher}
                  onSave={(data) => handleSavePublisher(publisher.id, data)}
                  onDelete={() => handleDeletePublisher(publisher.id)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
