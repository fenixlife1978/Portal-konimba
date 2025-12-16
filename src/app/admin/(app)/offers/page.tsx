'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
import { MoreHorizontal, Pencil, Trash2, ArrowLeft, PlusCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';


type Offer = {
  id: string;
  name: string;
  paymentAmount: number;
  status: 'active' | 'inactive';
};

const offerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  paymentAmount: z.coerce.number().positive("El monto debe ser un número positivo."),
  status: z.enum(['active', 'inactive']),
});

type OfferFormData = z.infer<typeof offerSchema>;

function OfferForm({ onSave, offer, onOpenChange }: { onSave: (data: OfferFormData) => Promise<void>; offer?: Offer | null, onOpenChange: (open: boolean) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
    defaultValues: offer || { name: '', paymentAmount: 0, status: 'active' },
  });

  const handleFormSubmit = async (data: OfferFormData) => {
    await onSave(data);
    onOpenChange(false);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <DialogHeader>
        <DialogTitle>{offer ? 'Editar Oferta' : 'Crear Nueva Oferta'}</DialogTitle>
        <DialogDescription>
          {offer ? 'Modifica los detalles de la oferta.' : 'Completa los campos para crear una nueva oferta.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">Nombre</Label>
          <Input id="name" {...register('name')} className="col-span-3" />
          {errors.name && <p className="col-span-4 text-right text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="paymentAmount" className="text-right">Monto (USD)</Label>
          <Input id="paymentAmount" type="number" step="0.01" {...register('paymentAmount')} className="col-span-3" />
          {errors.paymentAmount && <p className="col-span-4 text-right text-sm text-destructive">{errors.paymentAmount.message}</p>}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="status" className="text-right">Estado</Label>
          <select id="status" {...register('status')} className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
        <Button type="submit">Guardar</Button>
      </DialogFooter>
    </form>
  );
}

function OfferRow({ offer, onSave, onDelete }: { offer: Offer; onSave: (data: Partial<Offer>) => Promise<void>; onDelete: () => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">{offer.name}</TableCell>
      <TableCell>${offer.paymentAmount.toFixed(2)}</TableCell>
      <TableCell>
        <Badge variant={offer.status === 'active' ? 'default' : 'secondary'}>
          {offer.status === 'active' ? 'Activa' : 'Inactiva'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem></DialogTrigger>
              <DialogContent><OfferForm offer={offer} onSave={onSave} onOpenChange={setIsEditing} /></DialogContent>
            </Dialog>
            <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
              <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>¿Estás seguro?</DialogTitle><DialogDescription>Esta acción eliminará la oferta permanentemente.</DialogDescription></DialogHeader>
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

export default function OffersPage() {
  const firestore = db;
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const offersCollectionRef = useMemo(() => firestore ? collection(firestore, 'offers') : null, [firestore]);
  const { data: offers, isLoading } = useCollection<Offer>(offersCollectionRef);

  const handleSaveOffer = async (id: string | null, data: OfferFormData) => {
    if (!firestore) return;
    try {
      if (id) {
        const offerRef = doc(firestore, 'offers', id);
        await updateDoc(offerRef, { ...data, updatedAt: serverTimestamp() });
        toast({ title: "Oferta actualizada" });
      } else {
        await addDoc(collection(firestore, 'offers'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast({ title: "Oferta creada" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'offers', id));
      toast({ title: "Oferta eliminada" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message });
    }
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Ofertas</h1>
        <div className='flex gap-2'>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button><PlusCircle className="mr-2 h-4 w-4" />Crear Oferta</Button>
            </DialogTrigger>
            <DialogContent><OfferForm onSave={(data) => handleSaveOffer(null, data)} onOpenChange={setIsCreateModalOpen} /></DialogContent>
          </Dialog>
          <Button asChild variant="outline"><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Monto (USD)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center">Cargando ofertas...</TableCell></TableRow>}
              {!isLoading && offers?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No se encontraron ofertas.</TableCell></TableRow>}
              {offers?.map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  onSave={(data) => handleSaveOffer(offer.id, data as OfferFormData)}
                  onDelete={() => handleDeleteOffer(offer.id)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
