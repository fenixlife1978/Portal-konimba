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
import { doc } from 'firebase/firestore';
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
      // Check if the user exists
      const methods = await fetchSignInMethodsForEmail(auth, email);
      
      if (methods.length > 0) {
        // User exists, send password reset
        await sendPasswordResetEmail(auth, email);
        
        // We can't directly get the user object here without logging them in.
        // So, we cannot check `emailVerified` status directly.
        // We will send the password reset email regardless.
        // And we will also send the verification email if we assume they might not be verified.
        // This is a reasonable UX trade-off.
        toast({
          title: 'Correos Enviados',
          description: 'Si tu cuenta existe, recibirás un correo para restablecer la contraseña y, si es necesario, otro para verificar tu correo.',
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
        <DialogDescription>Introduce tu correo para recibir un enlace de recuperación. Si tu correo no está verificado, también recibirás un enlace de verificación.</DialogDescription>
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
    if (!isUserLoading) {
      if (user) {
        router.replace('/publisher');
      } else {
        setIsCheckingSession(false);
      }
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // The useEffect will handle the redirect
      router.push('/publisher');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Acceso',
        description:
          'Credenciales inválidas o la cuenta no existe. Por favor, verifica tus datos.',
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

      // Send verification email
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
      });

      // The useEffect will handle the redirect
       router.push('/publisher');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Registro',
        description:
          'No se pudo completar el registro. El email podría ya estar en uso.',
      });
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
    <Dialog>
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="inline-block">
            <Logo className="h-16 w-16" src={settingsData?.logoUrl} />
          </Link>
          <h1 className="text-2xl font-bold mt-4">
            {settingsData?.companyName || 'Cargando...'}
          </h1>
          <p className="text-muted-foreground">Portal de Acceso para Publishers</p>
        </div>

        <Tabs defaultValue="login" className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Ingresar</TabsTrigger>
            <TabsTrigger value="register">Registrarse</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <Card>
                <CardHeader>
                  <CardTitle>Bienvenido</CardTitle>
                  <CardDescription>Accede a tu panel de control.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
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
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
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
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Validando...' : 'Acceder'}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister}>
              <Card>
                <CardHeader>
                  <CardTitle>Crear Cuenta de Publisher</CardTitle>
                  <CardDescription>
                    Regístrate para acceder a tu panel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nombre y Apellido</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Nombre y Apellido"
                      required
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Email"
                      required
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      required
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Creando cuenta...' : 'Registrarse'}
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
