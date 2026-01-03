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
import { signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-material";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Cookies from "js-cookie";

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
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const auth = useAuth();
  const firestore = db;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const settingsRef = useMemo(() => firestore ? doc(firestore, 'settings', 'company') : null, [firestore]);
  const { data: settingsData } = useDoc<CompanySettings>(settingsRef);

  // LÓGICA DE REDIRECCIÓN POR ROL
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    const checkRoleAndRedirect = async () => {
      setIsCheckingRole(true);
      if (!firestore) return;

      try {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        const publisherRef = doc(firestore, 'publishers', user.uid);

        const [adminDoc, publisherDoc] = await Promise.all([
          getDoc(adminRoleRef),
          getDoc(publisherRef)
        ]);

        if (adminDoc.exists()) {
          toast({ title: "Modo Administrador", description: "Cargando panel de control..." });
          router.push('/admin');
          return;
        }

        if (publisherDoc.exists()) {
          toast({ title: "Modo Publisher", description: "Cargando tu panel..." });
          router.push('/publisher');
          return;
        }

        // Si no está en ninguna colección
        setIsCheckingRole(false);
      } catch (error) {
        console.error("Error validando rol:", error);
        setIsCheckingRole(false);
      }
    };

    checkRoleAndRedirect();
  }, [user, isUserLoading, router, firestore, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const token = await userCredential.user.getIdToken();
      
      // Creamos la cookie para que el middleware nos deje pasar
      Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });
      
      // Forzamos el refresh para que el middleware lea la nueva cookie
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Credenciales incorrectas o usuario no registrado.",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
        const token = await userCredential.user.getIdToken();
        Cookies.set('session', token, { expires: 7, secure: true, sameSite: 'strict' });

        await updateProfile(userCredential.user, { displayName: registerName });

        const nameParts = registerName.trim().split(' ');
        await setDoc(doc(firestore, 'publishers', userCredential.user.uid), {
            id: userCredential.user.uid,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: userCredential.user.email,
            status: 'active',
            createdAt: serverTimestamp(),
        });
        
        router.refresh();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo crear la cuenta." });
    }
  };

  if (isUserLoading || isCheckingRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground animate-pulse">Verificando credenciales y permisos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="mb-8 text-center">
        <Logo className="h-20 w-20 mx-auto" src={settingsData?.logoUrl} />
        <h1 className="text-3xl font-bold mt-4">{settingsData?.companyName || "Portal de Gestión"}</h1>
        <p className="text-muted-foreground">Ingresa para acceder a tu panel personalizado</p>
      </div>

      <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
          <TabsTrigger value="register">Registro Publisher</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <Card>
              <CardHeader>
                <CardTitle>Acceso Universal</CardTitle>
                <CardDescription>El sistema detectará tu rol automáticamente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña</Label>
                  <Input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit">Entrar al Panel</Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <Card>
              <CardHeader>
                <CardTitle>Nuevo Publisher</CardTitle>
                <CardDescription>Crea tu cuenta de colaborador.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Nombre Completo" required value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
                <Input type="email" placeholder="Email" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                <Input type="password" placeholder="Contraseña (min. 6)" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
              </CardContent>
              <CardFooter>
                <Button className="w-full" type="submit">Registrarme</Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}