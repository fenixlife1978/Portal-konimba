
'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Pencil, Trash2, ArrowLeft, PlusCircle, Globe, DollarSign, Building2, Hash, SwitchCamera } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Switch } from '@/components/ui/switch';

type Offer = {
  id: string;
  networkOfferId: string;
  name: string;
  agency: string;
  paymentAmount: number;
  trackingUrl: string;
  status: 'active' | 'inactive';
};

const offerSchema = z.object({
  networkOfferId: z.string().min(1, "El ID de la red es requerido."),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  agency: z.string().min(1, "La agencia es requerida."),
  paymentAmount: z.coerce.number().positive("El monto debe ser un número positivo."),
  trackingUrl: z.string().url("Debe ser una URL válida.").or(z.literal('')),
  status: z.enum(['active', 'inactive']),
});

type OfferFormData = z.infer<typeof offerSchema>;

function OfferForm({ onSave, offer, onOpenChange }: { onSave: (data: OfferFormData) => void; offer?: Offer | null, onOpenChange: (open: boolean) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
    defaultValues: offer || { 
        networkOfferId: '',
        name: '', 
        agency: 'Cpamerchant',
        paymentAmount: 0, 
        trackingUrl: '',
        status: 'active' 
    },
  });

  const handleFormSubmit = (data: OfferFormData) => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{offer ? 'Editar Campaña' : 'Crear Nueva Campaña'}</DialogTitle>
        <DialogDescription>
          Configura los detalles de la oferta para el tracking automático.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="networkOfferId">ID de la Red (CPA ID)</Label>
                <Input id="networkOfferId" {...register('networkOfferId')} placeholder="Ej: 1254" />
                {errors.networkOfferId && <p className="text-xs text-destructive">{errors.networkOfferId.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="agency">Agencia / Network</Label>
                <Input id="agency" {...register('agency')} placeholder="Ej: Cpamerchant" />
                {errors.agency && <p className="text-xs text-destructive">{errors.agency.message}</p>}
            </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la Campaña</Label>
          <Input id="name" {...register('name')} placeholder="Ej: Nutra Diet - US" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="paymentAmount">Pago por Lead (USD)</Label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="paymentAmount" type="number" step="0.01" {...register('paymentAmount')} className="pl-9" />
                </div>
                {errors.paymentAmount && <p className="text-xs text-destructive">{errors.paymentAmount.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="status">Estado Inicial</Label>
                <select id="status" {...register('status')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="active">Activa</option>
                    <option value="inactive">Pausada</option>
                </select>
            </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackingUrl">URL Base de Tracking</Label>
          <Input id="trackingUrl" {...register('trackingUrl')} placeholder="https://track.network.com/click?o=1&s={subid}" />
          <p className="text-[10px] text-muted-foreground">Usa {`{subid}`} para el tracking dinámico.</p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
        <Button type="submit">Guardar Campaña</Button>
      </DialogFooter>
    </form>
  );
}

export default function OffersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deletingOffer, setDeletingOffer] = useState<Offer | null>(null);

  const offersCollectionRef = useMemo(() => firestore ? collection(firestore, 'offers') : null, [firestore]);
  const { data: offers, isLoading } = useCollection<Offer>(offersCollectionRef);

  const handleSaveOffer = (id: string | null, data: OfferFormData) => {
    if (!firestore) return;
    
    if (id) {
      const offerRef = doc(firestore, 'offers', id);
      updateDocumentNonBlocking(offerRef, data);
      toast({ title: "Campaña actualizada" });
    } else {
      const offersCollection = collection(firestore, 'offers');
      addDocumentNonBlocking(offersCollection, data);
      toast({ title: "Campaña creada con éxito" });
    }
  };

  const handleToggleStatus = (offer: Offer) => {
    if (!firestore) return;
    const offerRef = doc(firestore, 'offers', offer.id);
    updateDocumentNonBlocking(offerRef, { status: offer.status === 'active' ? 'inactive' : 'active' });
    toast({ title: offer.status === 'active' ? "Campaña Pausada" : "Campaña Activada" });
  };

  const handleDeleteOffer = () => {
    if (!firestore || !deletingOffer) return;
    const offerRef = doc(firestore, 'offers', deletingOffer.id);
    deleteDocumentNonBlocking(offerRef);
    toast({ title: "Campaña eliminada permanentemente" });
    setDeletingOffer(null);
  };
  
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Gestión de Campañas</h1>
            <p className="text-muted-foreground font-medium mt-1">Control de ofertas, payouts y enlaces de tracking.</p>
        </div>
        <div className='flex gap-2'>
          <Button onClick={() => setIsCreateModalOpen(true)} className="rounded-xl shadow-lg shadow-primary/20">
            <PlusCircle className="mr-2 h-4 w-4" /> Nueva Campaña
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold py-4">Campaña / Network</TableHead>
                <TableHead className="font-bold">Pago (USD)</TableHead>
                <TableHead className="font-bold text-center">Estado</TableHead>
                <TableHead className="text-right font-bold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-12"><Building2 className="h-8 w-8 animate-pulse mx-auto opacity-20" /></TableCell></TableRow>}
              {!isLoading && offers?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No hay campañas configuradas.</TableCell></TableRow>}
              {offers?.map((offer) => (
                <TableRow key={offer.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">{offer.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-1">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{offer.agency}</Badge>
                            <span>ID: {offer.networkOfferId}</span>
                        </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center font-black text-emerald-600">
                        <DollarSign className="h-3 w-3" />
                        {offer.paymentAmount.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-3">
                        <Switch 
                            checked={offer.status === 'active'} 
                            onCheckedChange={() => handleToggleStatus(offer)}
                        />
                        <Badge variant={offer.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase min-w-[70px] justify-center">
                            {offer.status === 'active' ? 'Activa' : 'Pausada'}
                        </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-background">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditingOffer(offer); }}>
                            <Pencil className="mr-2 h-4 w-4" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href={offer.trackingUrl} target="_blank" rel="noopener noreferrer">
                                <Globe className="mr-2 h-4 w-4" />Probar Enlace
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingOffer(offer); }} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[500px]">
            <OfferForm onSave={(data) => handleSaveOffer(null, data)} onOpenChange={setIsCreateModalOpen} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingOffer} onOpenChange={(open) => !open && setEditingOffer(null)}>
        <DialogContent className="rounded-2xl sm:max-w-[500px]">
          {editingOffer && (
            <OfferForm offer={editingOffer} onSave={(data) => handleSaveOffer(editingOffer.id, data)} onOpenChange={(open) => !open && setEditingOffer(null)} />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Dialog */}
      <Dialog open={!!deletingOffer} onOpenChange={(open) => !open && setDeletingOffer(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">¿Eliminar campaña?</DialogTitle>
            <DialogDescription>Esta acción es irreversible y podría afectar el tracking de los leads entrantes para la oferta <b>{deletingOffer?.name}</b>.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <DialogClose asChild><Button variant="outline" className="rounded-xl">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteOffer} className="rounded-xl shadow-lg shadow-destructive/20">Sí, eliminar permanentemente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
