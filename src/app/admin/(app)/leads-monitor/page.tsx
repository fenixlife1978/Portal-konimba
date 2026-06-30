
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  DollarSign,
  Building2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Conversion = {
  id: string;
  conversionIdCpa: string;
  publisherName: string;
  subId: string;
  offerName: string;
  agency: string;
  amountUSD: number;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: any;
};

export default function LeadsMonitorPage() {
  const firestore = useFirestore();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const conversionsRef = useMemo(() => {
    if (!firestore) return null;
    let baseQuery = query(collection(firestore, 'leads_automated'), orderBy('createdAt', 'desc'), limit(100));
    return baseQuery;
  }, [firestore]);

  const { data: conversions, isLoading } = useCollection<Conversion>(conversionsRef);

  const filteredConversions = useMemo(() => {
    if (!conversions) return [];
    return conversions.filter(c => {
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesSearch = c.subId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.publisherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.conversionIdCpa?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [conversions, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    if (!conversions) return { approved: 0, pending: 0, rejected: 0, totalAmount: 0 };
    return conversions.reduce((acc, c) => {
      if (c.status === 'approved') {
        acc.approved++;
        acc.totalAmount += c.amountUSD;
      }
      if (c.status === 'pending') acc.pending++;
      if (c.status === 'rejected') acc.rejected++;
      return acc;
    }, { approved: 0, pending: 0, rejected: 0, totalAmount: 0 });
  }, [conversions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 rounded-lg gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 hover:bg-amber-600 rounded-lg gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="rounded-lg gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Monitor de Conversiones</h1>
          <p className="text-muted-foreground font-medium mt-1">Seguimiento en tiempo real de leads automatizados (Webhooks).</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Live Feed</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-none shadow-sm bg-emerald-500/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Aprobados</span>
                <span className="text-2xl font-black text-emerald-700">{stats.approved}</span>
            </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-amber-500/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Pendientes</span>
                <span className="text-2xl font-black text-amber-700">{stats.pending}</span>
            </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-destructive/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-destructive uppercase">Rechazados</span>
                <span className="text-2xl font-black text-destructive">{stats.rejected}</span>
            </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-primary/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-primary uppercase">Monto Total (App)</span>
                <span className="text-2xl font-black text-primary">${stats.totalAmount.toFixed(2)}</span>
            </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="p-6 pb-0">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar Conversión o SubID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="ID Conversión, SubID, Trabajador..." 
                  className="pl-10 rounded-xl bg-background/50" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-48 space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Estado</Label>
              <Select onValueChange={setFilterStatus} value={filterStatus}>
                <SelectTrigger className="rounded-xl bg-background/50">
                    <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-6">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold py-4">Conversión / Fecha</TableHead>
                <TableHead className="font-bold">Trabajador (SubID)</TableHead>
                <TableHead className="font-bold">Campaña</TableHead>
                <TableHead className="font-bold text-center">Monto</TableHead>
                <TableHead className="font-bold text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="h-8 w-8 animate-spin mx-auto opacity-20 text-primary" /></TableCell></TableRow>}
              {!isLoading && filteredConversions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-24 text-muted-foreground">
                    No se han registrado conversiones automatizadas todavía.
                  </TableCell>
                </TableRow>
              )}
              {filteredConversions.map((conv) => (
                <TableRow key={conv.id} className="group transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">{conv.conversionIdCpa}</span>
                      <span className="text-xs font-medium mt-0.5">
                        {conv.createdAt?.toDate ? format(conv.createdAt.toDate(), "dd/MM/yy HH:mm", { locale: es }) : 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{conv.publisherName}</span>
                      <Badge variant="outline" className="text-[9px] w-fit h-4 px-1 mt-1 font-mono">{conv.subId}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{conv.offerName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                        <Building2 className="h-2 w-2" /> {conv.agency}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black text-primary">${conv.amountUSD.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(conv.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
