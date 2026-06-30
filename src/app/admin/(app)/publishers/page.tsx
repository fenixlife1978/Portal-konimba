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
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowLeft,
  Check,
  Copy,
  X,
  Download,
  Loader2,
  Phone,
  ShieldCheck,
  ShieldX
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
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
        <DialogTitle>Editar Detalles del Miembro</DialogTitle>
        <DialogDescription>
          Modifica la información del trabajador {publisher.firstName} {publisher.lastName}.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
        <h3 className="font-bold text-primary">Información Personal</h3>
        <div className="grid grid-cols-2 gap-4">
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
        </div>
        <div>
          <Label htmlFor="phone">WhatsApp / Teléfono</Label>
          <Input
            id="phone"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+58 412 0000000"
          />
        </div>
        <div>
          <Label htmlFor="address">Dirección Corta</Label>
          <Input
            id="address"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
        
        <Separator className='my-4' />
        <div className="flex justify-between items-center">
            <h3 className="font-bold text-primary">Información de Pago</h3>
            <Button variant="outline" size="sm" onClick={handleCopyPaymentInfo}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Datos
            </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              value={formData.country || ''}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
          </div>
           <div>
            <Label htmlFor="paymentMethod">Método</Label>
            <Input
              id="paymentMethod"
              value={formData.paymentMethod || ''}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="usdtAddress">Email / Wallet (USDT)</Label>
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
                    className="h-8 w-24 text-xs"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave}><Check className="h-3 w-3" /></Button>
            </div>
        );
    }

    return (
        <div 
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => setIsEditing(true)}
        >
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{publisher.subId || <span className="text-muted-foreground opacity-50">SIN ID</span>}</span>
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
  const initials = `${publisher.firstName?.charAt(0) || ''}${publisher.lastName?.charAt(0) || ''}`;

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-bold text-sm">{publisher.firstName} {publisher.lastName}</span>
            <span className="text-xs text-muted-foreground">{publisher.email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-xs">
          <Phone className="h-3 w-3 text-emerald-500" />
          {publisher.phone || 'No asignado'}
        </div>
      </TableCell>
      <TableCell>
        <EditableSubIdCell publisher={publisher} onSave={onSave} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch 
            checked={publisher.status === 'active'} 
            onCheckedChange={(checked) => onSave(publisher.id, { status: checked ? 'active' : 'inactive' })}
          />
          <Badge variant={publisher.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase">
            {publisher.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEditClick(); }}>
              <Pencil className="mr-2 h-4 w-4" />Ver/Editar Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDeleteClick(); }} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Eliminar del Equipo
            </DropdownMenuItem>
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
    toast({ title: "Perfil Actualizado", description: "Los cambios se han sincronizado con el motor." });
    setEditingPublisher(null);
  };

  const handleDeletePublisher = () => {
    if (!firestore || !deletingPublisher) return;
    const publisherRef = doc(firestore, 'publishers', deletingPublisher.id);
    deleteDocumentNonBlocking(publisherRef);
    toast({ title: "Miembro Eliminado", description: "El acceso ha sido revocado y el registro eliminado."});
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

    const reportTitle = "Nómina de Equipo y Sub-IDs";
    const fileName = "Equipo_Trabajo.pdf";
    
    const head = [['Nombre', 'WhatsApp', 'Email', 'Sub ID', 'Estado']];
    const body = filteredPublishers.map(p => [
        `${p.firstName} ${p.lastName}`,
        p.phone || 'N/A',
        p.email,
        p.subId || 'N/A',
        p.status?.toUpperCase()
    ]);

    await exportToPDF({ head, body, fileName, reportTitle, companyName: settingsData?.companyName });
    
    setIsExporting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Equipo y SubIds</h1>
            <p className="text-muted-foreground font-medium mt-1">Gestión de trabajadores, enlaces de tracking y estados operativos.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" disabled={isExporting} className="rounded-xl">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar Lista
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
            </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="p-6 pb-0">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="relative w-full md:w-96">
                <Input
                  placeholder="Buscar por nombre, email o Sub ID..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-xl bg-background/50 pl-10"
                />
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
              </div>
              <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                <div className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500"/> {publishers?.filter(p => p.status === 'active').length || 0} Activos</div>
                <div className="flex items-center gap-1"><ShieldX className="h-3 w-3 text-amber-500"/> {publishers?.filter(p => p.status !== 'active').length || 0} Inactivos</div>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0 mt-6">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold text-foreground py-4">Miembro del Equipo</TableHead>
                <TableHead className="font-bold text-foreground">WhatsApp</TableHead>
                <TableHead className="font-bold text-foreground">Sub ID Asignado</TableHead>
                <TableHead className="font-bold text-foreground">Estado</TableHead>
                <TableHead className="text-right font-bold text-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>}
              {!isLoading && filteredPublishers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center h-48 text-muted-foreground">No se encontraron miembros en el equipo.</TableCell></TableRow>}
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
        <DialogContent className="sm:max-w-[625px] rounded-2xl">
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
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">¿Eliminar del equipo?</DialogTitle>
            <DialogDescription>
              Esta acción revocará el acceso de <b>{deletingPublisher?.firstName}</b> al portal y eliminará sus configuraciones. Los datos de leads y pagos se mantendrán por auditoría.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" className="rounded-xl">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeletePublisher} className="rounded-xl shadow-lg shadow-destructive/20">Sí, eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
