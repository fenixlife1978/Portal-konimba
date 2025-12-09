'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
import { MoreHorizontal, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

type Publisher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

function PublisherRow({ publisher, onSave, onDelete }: { publisher: Publisher; onSave: (data: Partial<Publisher>) => Promise<void>; onDelete: () => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedPublisher, setEditedPublisher] = useState(publisher);

  const handleSave = async () => {
    await onSave(editedPublisher);
    setIsEditing(false);
  };

  const handleDeleteConfirm = async () => {
    await onDelete();
    setIsDeleting(false);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditedPublisher(prev => ({ ...prev, [id]: value }));
  };

  return (
    <TableRow key={publisher.id}>
      <TableCell className="font-medium">{publisher.firstName}</TableCell>
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
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Publisher</DialogTitle>
                  <DialogDescription>
                    Realiza cambios en el perfil del publisher. Haz clic en guardar cuando termines.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="firstName" className="text-right">
                      Nombre
                    </Label>
                    <Input id="firstName" value={editedPublisher.firstName} onChange={handleInputChange} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="lastName" className="text-right">
                      Apellido
                    </Label>
                    <Input id="lastName" value={editedPublisher.lastName} onChange={handleInputChange} className="col-span-3" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Teléfono
                    </Label>
                    <Input id="phone" value={editedPublisher.phone || ''} onChange={handleInputChange} className="col-span-3" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="address" className="text-right">
                      Dirección
                    </Label>
                    <Input id="address" value={editedPublisher.address || ''} onChange={handleInputChange} className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleSave}>Guardar Cambios</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
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
  const firestore = useFirestore();
  const { toast } = useToast();

  const publishersCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'publishers');
  }, [firestore]);

  const { data: publishers, isLoading } = useCollection<Publisher>(publishersCollectionRef);

  const handleSavePublisher = async (id: string, data: Partial<Publisher>) => {
    if (!firestore) return;
    const publisherRef = doc(firestore, 'publishers', id);
    try {
      await updateDoc(publisherRef, { ...data, updatedAt: serverTimestamp() });
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
              {!isLoading && publishers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
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
