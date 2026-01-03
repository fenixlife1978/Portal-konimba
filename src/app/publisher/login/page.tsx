'use client';
import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser, useDoc } from "@/firebase"; 
import { db } from '@/firebase/config';
import { signInWithEmailAndPassword, updateProfile, createUserWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Cookies from "js-cookie";
import { Loader2 } from "lucide-react";

type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
};

export default function PublisherAuthPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();
  const firestore = db;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  // If user is already logged in, redirect them to their dashboard.
  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/publisher');
    }
  }, [user, isUserLoading, router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const token = await userCredential.user.getIdToken();
      Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });
      // The useEffect above will handle the redirect.
      // We manually trigger a refresh to make sure middleware and layouts re-evaluate.
      router.refresh();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Credenciales inválidas o la cuenta no existe. Por favor, verifica tus datos."
      });
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    setIsLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
        const token = await userCredential.user.getIdToken();
        Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });

        const [firstName, ...lastNameParts] = registerName.trim().split(' ');
        const lastName = lastNameParts.join(' ');

        await updateProfile(userCredential.user, { displayName: registerName });

        await setDoc(doc(firestore, 'publishers', userCredential.user.uid), {
            id: userCredential.user.uid,
            firstName: firstName || '',
            lastName: lastName || '',
            email: userCredential.user.email,
            status: 'active',
            createdAt: serverTimestamp(),
        });
        
        router.refresh();
    } catch (error: any) {
        toast({ 
            variant: "destructive", 
            title: "Error de Registro", 
            description: "No se pudo completar el registro. El email podría ya estar en uso." 
        });
    } finally {
        setIsLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }
  
  // If user is logged in, we render nothing while the redirect happens.
  if (user) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="h-16 w-16" src={settingsData?.logoUrl} />
        <h1 className="text-2xl font-bold mt-4">{settingsData?.companyName || "Cargando..."}</h1>
        <p className="text-muted-foreground">Portal de Publishers</p>
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
                <Input type="email" placeholder="Email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} />
                <Input type="password" placeholder="Contraseña" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} disabled={isLoading} />
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Validando..." : "Acceder"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <Card>
                <CardHeader>
                    <CardTitle>Crear Cuenta</CardTitle>
                    <CardDescription>Regístrate para acceder a tu panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input type="text" placeholder="Nombre y Apellido" required value={registerName} onChange={(e) => setRegisterName(e.target.value)} disabled={isLoading} />
                    <Input type="email" placeholder="Email" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} disabled={isLoading} />
                    <Input type="password" placeholder="Contraseña (mínimo 6 caracteres)" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} disabled={isLoading} />
                </CardContent>
                <CardFooter>
                    <Button className="w-full" type="submit" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isLoading ? "Creando cuenta..." : "Registrarse"}
                    </Button>
                </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
