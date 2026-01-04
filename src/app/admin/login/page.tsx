'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

// ForgotPasswordDialog Component
function ForgotPasswordDialog() {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const auth = useAuth();
  const { toast } = useToast();

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Correo Requerido',
        description: 'Por favor, introduce tu correo electrónico.',
      });
      return;
    }
    if (!auth) return;

    setIsSending(true);
    try {
      // Nota: Firebase no proporciona una forma de verificar si un correo existe antes de enviar el correo de restablecimiento por razones de seguridad.
      // Simplemente intentamos enviar y notificamos al usuario.
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Correo Enviado',
        description:
          'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.',
      });
    } catch (error: any) {
      // No mostramos errores específicos al usuario para no revelar si un correo existe o no.
       toast({
        title: 'Correo Enviado',
        description:
          'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.',
      });
    } finally {
      setIsSending(false);
      // Cierra el diálogo por nosotros si es necesario
      // O gestiona el estado de apertura desde el componente padre
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Recuperar Contraseña</DialogTitle>
        <DialogDescription>
          Introduce tu correo electrónico para recibir un enlace de recuperación.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="tu.correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSending}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isSending}>Cancelar</Button>
        </DialogClose>
        <Button onClick={handlePasswordReset} disabled={isSending}>
          {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSending ? 'Enviando...' : 'Enviar Correo'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}


export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        // If user is logged in, verify they are an admin.
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        getDoc(adminRoleRef).then(docSnap => {
          if (docSnap.exists()) {
            router.replace('/admin'); // Already an admin, go to dashboard
          } else {
            // Not an admin, maybe a publisher? Logout and stay here.
            auth.signOut();
            setIsCheckingSession(false);
          }
        });
      } else {
        setIsCheckingSession(false);
      }
    }
  }, [user, isUserLoading, firestore, router, auth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const adminRoleRef = doc(firestore, 'roles_admin', uid);
      const docSnap = await getDoc(adminRoleRef);

      if (docSnap.exists()) {
        router.replace('/admin');
      } else {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Acceso Denegado',
          description: 'No tienes permisos de administrador.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Acceso',
        description: 'Credenciales inválidas. Por favor, verifica tus datos.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-muted-foreground">Validando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="inline-block">
          <Logo className="h-16 w-16" src={settingsData?.logoUrl} />
        </Link>
        <h1 className="text-2xl font-bold mt-4">{settingsData?.companyName || 'Cargando...'}</h1>
        <p className="text-muted-foreground">Portal de Acceso para Administradores</p>
      </div>

      <Dialog>
        <form onSubmit={handleLogin}>
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Bienvenido Administrador</CardTitle>
              <CardDescription>Accede a tu panel de control.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Email de administrador"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Contraseña"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
               <div className="text-sm">
                <DialogTrigger asChild>
                  <Button variant="link" className="p-0 h-auto">
                    ¿Olvidaste tu contraseña?
                  </Button>
                </DialogTrigger>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Validando...' : 'Acceder'}
              </Button>
            </CardFooter>
          </Card>
        </form>
        <ForgotPasswordDialog />
      </Dialog>

      <Button asChild variant="link" className="mt-8">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la página de inicio
        </Link>
      </Button>
    </div>
  );
}
