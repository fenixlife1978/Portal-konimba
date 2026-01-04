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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/ui/logo';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

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
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Validando...' : 'Acceder'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Button asChild variant="link" className="mt-8">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la página de inicio
        </Link>
      </Button>
    </div>
  );
}
