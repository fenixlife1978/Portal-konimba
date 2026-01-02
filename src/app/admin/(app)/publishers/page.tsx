'use client';

import { useState, useMemo } from 'react';
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
  CaseSensitive,
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

const phoneCodes = ['0412', '0414', '0416', '0424', '0426'];
const idPrefixes = ['V', 'E', 'J', 'G', 'P'];

type BankVE = { id: string; name: string };
type BankCO = { code: string; name: string };

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

const banksVeNames = (banksVe as BankVE[]).map((b) => b.name);
const banksCoNames = (banksCo as BankCO[]).map((b) => b.name);

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

/* ---------- PaymentReadOnly ---------- */
function PaymentReadOnly({ publisher }: { publisher: Publisher }) {
  const isVE = publisher.country === 'VE';

  return (
    <>
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
          <div className="space-y-2 md:col-span-2">
            <Label>Referencia bancos por país</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-2 border rounded">
                <p className="text-sm font-medium">Bancos VE (referencia)</p>
                <div className="text-xs text-muted-foreground">{banksVeNames.slice(0, 6).join(', ')}...</div>
              </div>
              <div className="p-2 border rounded">
                <p className="text-sm font-medium">Bancos CO (referencia)</p>
                <div className="text-xs text-muted-foreground">{banksCoNames.slice(0, 6).join(', ')}...</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {publisher.paymentMethod === 'pagoMovil' && isVE && (
        <>
          <div className="space-y-2">
            <Label htmlFor="mobilePaymentBank">Banco (Pago Móvil)</Label>
            <Input id="mobilePaymentBank" value={publisher.mobilePaymentBank || ''} readOnly disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono (Pago Móvil)</Label>
              <Input
                value={`${publisher.mobilePaymentPhoneCode || ''}${publisher.mobilePaymentPhoneNumber || ''}`}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Cédula o RIF (Pago Móvil)</Label>
              <Input
                value={`${publisher.mobilePaymentIdPrefix || ''}${publisher.mobilePaymentIdNumber || ''}`}
                readOnly
                disabled
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>Códigos de teléfono válidos</Label>
              <Select disabled defaultValue={phoneCodes[0]}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona código" />
                </SelectTrigger>
                <SelectContent>
                  {phoneCodes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prefijos de identificación válidos</Label>
              <Select disabled defaultValue={idPrefixes[0]}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona prefijo" />
                </SelectTrigger>
                <SelectContent>
                  {idPrefixes.map((prefix) => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {publisher.paymentMethod === 'usdt' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class