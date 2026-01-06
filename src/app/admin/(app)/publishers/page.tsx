'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import {
  collection,
  doc,
} from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
  Check,
  Copy,
  X,
  Download,
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
import { exportToPDF } from '@/lib/export-pdf';

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

type CompanySettings = {
  companyName?: string;
};


/* ---------- EditDetailsModal ---------- */
interface EditDetailsModalProps {
  publisher: Publisher;
  onSave: (data: Partial<Publisher>) => void;
  onOpenChange: (open: boolean) => void;
}

function EditDetailsModal({ publisher, onSave, onOpenChange }: EditDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Publisher>>({});
  const { toast } = useToast();

  useState(() => {
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
  });


  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };
  
  const handleCopyPaymentInfo = () => {
    let textToCopy = `Datos de pago para: ${publisher.firstName} ${publisher.lastName}\n`;

    switch (publisher.paymentMethod) {
      case 'transferencia':
        textToCopy += `Método: Transferencia\nPaís: ${publisher.country}\nBanco: ${publisher.bank}\nCuenta: ${publisher.accountNumber}`;
        break;
      case 'pagoMovil':
        textToCopy += `Método: Pago Móvil\nPaís: Venezuela\nBanco: ${publisher.mobilePaymentBank}\nTeléfono: ${publisher.mobilePaymentPhone}\nCédula/RIF: ${publisher.mobilePaymentId}`;
        break;
      case 'usdt':
        textToCopy += `Método: USDT\nPlataforma: Binance\nEmail: ${publisher.usdtAddress}`;
        break;
      default:
        textToCopy = 'No hay método de pago configurado para este publisher.';
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({ title: 'Copiado al portapapeles', description: 'Los datos de pago se han copiado.' });
    }).catch(err => {
      toast({ variant: 'destructive', title: 'Error al copiar', description: 'No se pudo copiar la información.' });
    });
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
        <div className="flex justify-between items-center">
            <h3 className="font-bold">Información de Pago</h3>
            <Button variant="outline" size="sm" onClick={handleCopyPaymentInfo}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Info de Pago
            </Button>
        </div>
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

// Inline Editable Sub ID Cell Component
function EditableSubIdCell({ publisher, onSave }: { publisher: Publisher; onSave: (id: string, data: Partial<Publisher>) => void; }) {
    const [isEditing, setIsEditing] = useState(false);
    const [subId, setSubId] = useState(publisher.subId || '');
    const { toast } = useToast();

    const handleSave = () => {
        if (subId !== (publisher.subId || '')) {
            onSave(publisher.id, { subId });
            toast({ title: "Sub ID actualizado" });
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setSubId(publisher.subId || '');
        setIsEditing(false);
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <Input 
                    value={subId} 
                    onChange={(e) => setSubId(e.target.value)} 
                    className="h-8"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button size="icon" className="h-8 w-8" onClick={handleSave}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCancel}><X className="h-4 w-4" /></Button>
            </div>
        );
    }

    return (
        <div 
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => setIsEditing(true)}
        >
            <span>{publisher.subId || <span className="text-muted-foreground">N/A</span>}</span>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

function PublisherRow({ publisher, onSave, onEditClick, onDeleteClick }: { 
  publisher: Publisher; 
  onSave: (id: string, data: Partial<Publisher>) => void; 
  onEditClick: () => void;
  onDeleteClick: () => void;
}) {
  return (
    <TableRow>
      <TableCell>{publisher.firstName} {publisher.lastName}</TableCell>
      <TableCell>{publisher.email}</TableCell>
      <TableCell>
        <EditableSubIdCell publisher={publisher} onSave={onSave} />
      </TableCell>
      <TableCell><Badge variant={publisher.status === 'active' ? 'default' : 'secondary'}>{publisher.status}</Badge></TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditClick}><Pencil className="mr-2 h-4 w-4" />Ver Detalles</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDeleteClick} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar Publisher</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function PublishersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [filter, setFilter] = useState('');
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [deletingPublisher, setDeletingPublisher] = useState<Publisher | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const publishersCollectionRef = useMemo(() => (firestore && user ? collection(firestore, 'publishers') : null), [firestore, user]);
  const { data: publishers, isLoading } = useCollection<Publisher>(publishersCollectionRef);
  
  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  const handleUpdatePublisher = (id: string, data: Partial<Publisher>) => {
    if (!firestore) return;
    const publisherRef = doc(firestore, 'publishers', id);
    updateDocumentNonBlocking(publisherRef, data);
    toast({ title: "Publisher actualizado" });
    setEditingPublisher(null);
  };

  const handleDeletePublisher = () => {
    if (!firestore || !deletingPublisher) return;
    const publisherRef = doc(firestore, 'publishers', deletingPublisher.id);
    deleteDocumentNonBlocking(publisherRef);
    toast({ title: "Publisher eliminado", description: "El documento del publisher fue eliminado. La cuenta de Auth sigue activa."});
    setDeletingPublisher(null);
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
  
  const handleExport = async () => {
    if (!filteredPublishers || filteredPublishers.length === 0) {
      toast({ title: "No hay datos para exportar" });
      return;
    }
    setIsExporting(true);

    const reportTitle = "Lista de Publishers";
    const fileName = "Lista_Publishers.pdf";
    
    const head = [['Nombre', 'Email', 'Sub ID']];
    const body = filteredPublishers.map(p => [
        `${p.firstName} ${p.lastName}`,
        p.email,
        p.subId || 'N/A'
    ]);

    await exportToPDF({ head, body, fileName, reportTitle, companyName: settingsData?.companyName });
    
    setIsExporting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold font-headline text-foreground">Gestión de Publishers</h1>
            <p className="text-muted-foreground">Modifica y gestiona los perfiles de los publishers.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exportando...' : 'Exportar a PDF'}
            </Button>
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
                  onEditClick={() => setEditingPublisher(publisher)}
                  onDeleteClick={() => setDeletingPublisher(publisher)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPublisher} onOpenChange={(open) => !open && setEditingPublisher(null)}>
        <DialogContent className="sm:max-w-[625px]">
          {editingPublisher && (
            <EditDetailsModal 
              publisher={editingPublisher} 
              onSave={(data) => handleUpdatePublisher(editingPublisher.id, data)} 
              onOpenChange={(open) => !open && setEditingPublisher(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Dialog */}
      <Dialog open={!!deletingPublisher} onOpenChange={(open) => !open && setDeletingPublisher(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
            <DialogDescription>Esta acción eliminará al publisher permanentemente y no se podrá deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" onClick={() => setDeletingPublisher(null)}>Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeletePublisher}>Sí, eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
