
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
import {
  signInWithEmailAndPassword,
  updateProfile,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      toast({ variant: 'destructive', title: 'Correo Requerido', description: 'Por favor, introduce tu correo.' });
      return;
    }
    if (!auth) return;

    setIsSending(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      
      if (methods.length > 0) {
        await sendPasswordResetEmail(auth, email);
        toast({
          title: 'Correos Enviados',
          description: 'Si tu cuenta existe, recibirás un correo para restablecer la contraseña.',
        });
      } else {
        toast({
          title: 'Solicitud Procesada',
          description: 'Si hay una cuenta asociada a este correo, recibirás las instrucciones necesarias.',
        });
      }

    } catch (error) {
       toast({
        title: 'Solicitud Procesada',
        description: 'Si hay una cuenta asociada a este correo, recibirás las instrucciones necesarias.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Recuperar Contraseña</DialogTitle>
        <DialogDescription>Introduce tu correo para recibir un enlace de recuperación.</DialogDescription>
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
        <DialogClose asChild><Button variant="outline" disabled={isSending}>Cancelar</Button></DialogClose>
        <Button onClick={handlePasswordReset} disabled={isSending}>
          {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar Correo
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}


export default function PublisherLoginPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(
    () => (firestore ? doc(firestore, 'settings', 'company') : null),
    [firestore]
  );
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  useEffect(() => {
    if (!isUserLoading && firestore) {
      if (user) {
        // Verify it's not an admin trying to login as worker
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        getDoc(adminRoleRef).then(docSnap => {
          if (docSnap.exists()) {
             auth.signOut().then(() => {
                setIsCheckingSession(false);
                toast({
                  variant: 'destructive',
                  title: 'Acceso Denegado',
                  description: 'Las cuentas administrativas no pueden ingresar al portal de equipo. Usa el acceso de admin.'
                });
             });
          } else {
            router.replace('/publisher');
          }
        });
      } else {
        setIsCheckingSession(false);
      }
    }
  }, [user, isUserLoading, router, firestore, auth, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const uid = userCredential.user.uid;

      // Anti-Admin Check
      const adminRoleRef = doc(firestore, 'roles_admin', uid);
      const docSnap = await getDoc(adminRoleRef);

      if (docSnap.exists()) {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Acceso Denegado',
          description: 'Esta cuenta es de administrador. Por favor, usa el portal administrativo.',
        });
        setIsLoading(false);
      } else {
        router.push('/publisher');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Acceso',
        description: 'Credenciales inválidas. Por favor, verifica tus datos.',
      });
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        registerEmail,
        registerPassword
      );
      const { user } = userCredential;
      const uid = user.uid;

      await sendEmailVerification(user);
      toast({
        title: '¡Registro casi listo!',
        description: 'Se ha enviado un correo de verificación. Por favor, revisa tu bandeja de entrada.',
      });

      const [firstName, ...lastNameParts] = registerName.trim().split(' ');
      const lastName = lastNameParts.join(' ');

      await updateProfile(userCredential.user, { displayName: registerName });

      const publisherDocRef = doc(firestore, 'publishers', uid);
      setDocumentNonBlocking(publisherDocRef, {
        id: uid,
        firstName: firstName || '',
        lastName: lastName || '',
        email: userCredential.user.email,
        status: 'active',
        createdAt: serverTimestamp(),
      });

       router.push('/publisher');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Registro',
        description: 'No se pudo completar el registro. El email podría ya estar en uso.',
      });
      setIsLoading(false);
    }
  };
  
  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground font-medium">Validando sesión...</p>
      </div>
    );
  }

  return (
    <Dialog>
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="inline-block">
            <Logo className="h-16 w-16" src={settingsData?.logoUrl} />
          </Link>
          <h1 className="text-2xl font-bold mt-4">
            {settingsData?.companyName || 'Cargando...'}
          </h1>
          <p className="text-muted-foreground">Portal de Acceso para el Equipo</p>
        </div>

        <Tabs defaultValue="login" className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="login" className="rounded-lg">Ingresar</TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg">Registrarse</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <Card className="rounded-2xl border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Bienvenido</CardTitle>
                  <CardDescription>Accede a tu panel de rendimiento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="Email corporativo" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} className="rounded-xl bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input id="login-password" type="password" placeholder="Contraseña" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} disabled={isLoading} className="rounded-xl bg-muted/30" />
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
                  <Button className="w-full rounded-xl" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Acceder"}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister}>
              <Card className="rounded-2xl border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Unirse al Equipo</CardTitle>
                  <CardDescription>Regístrate para empezar a generar leads.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nombre y Apellido</Label>
                    <Input id="register-name" type="text" placeholder="Tu nombre completo" required value={registerName} onChange={(e) => setRegisterName(e.target.value)} disabled={isLoading} className="rounded-xl bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" type="email" placeholder="Email corporativo" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} disabled={isLoading} className="rounded-xl bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input id="register-password" type="password" placeholder="Mínimo 6 caracteres" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} disabled={isLoading} className="rounded-xl bg-muted/30" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full rounded-xl" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Registrarse"}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>
        </Tabs>
        <Button asChild variant="link" className="mt-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la página de inicio
          </Link>
        </Button>
      </div>
      <ForgotPasswordDialog />
    </Dialog>
  );
}
